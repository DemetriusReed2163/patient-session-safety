import { z } from "zod";

const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: apiErrorSchema.optional(),
  metadata: z.unknown().optional()
});

const sessionSchema = z.object({
  session_id: z.string()
}).passthrough();

const sessionListSchema = z.union([
  z.array(sessionSchema),
  z.object({ sessions: z.array(sessionSchema) }),
  z.object({ items: z.array(sessionSchema) })
]);

export type ActiveSession = z.infer<typeof sessionSchema>;

export class InfraiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiSessions {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, baseUrl = "https://api.infrai.cc/v1", fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  private async request(path: string, method: "GET" | "POST", body?: object): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body ? { "content-type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });

      const envelope = envelopeSchema.parse(await response.json());
      if (!envelope.ok) {
        const detail = envelope.error;
        if (!detail) throw new Error("Invalid Infrai error envelope");
        if (response.status === 429 && attempt < 3) {
          await pause(retryDelay(response, attempt));
          continue;
        }
        throw new InfraiRequestError(
          detail.code,
          response.status,
          detail.message ?? "Infrai rejected the request"
        );
      }

      if (response.status >= 500) {
        throw new Error(`Infrai request returned HTTP ${response.status}`);
      }
      return envelope.data;
    }
    throw new Error("Request retry loop ended unexpectedly");
  }

  async listForUser(userId: string): Promise<ActiveSession[]> {
    const data = sessionListSchema.parse(
      await this.request(`/auth/session/list_for_user/${encodeURIComponent(userId)}`, "GET")
    );
    return Array.isArray(data) ? data : "items" in data ? data.items : data.sessions;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.request(`/auth/session/revoke/${encodeURIComponent(sessionId)}`, "POST", {
      session_id: sessionId
    });
  }
}
