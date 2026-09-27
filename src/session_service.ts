import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiRequestError, InfraiSessions } from "./infrai_sessions.js";
import { cleanupRequestSchema, cleanUpOtherSessions } from "./session_cleanup.js";

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const sessions = new InfraiSessions(apiKey);
const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/session-cleanup") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = cleanupRequestSchema.parse(await readJson(request));
    try {
      send(response, 200, await cleanUpOtherSessions(input, sessions));
    } catch (error) {
      if (error instanceof InfraiRequestError) {
        const status = error.status >= 400 && error.status < 500 ? error.status : 502;
        send(response, status, { error: error.code, message: error.message });
        return;
      }
      send(response, 502, { error: "Invalid Infrai response" });
    }
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid request body" });
      return;
    }
    send(response, 500, { error: "Unexpected service error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Session service listening on http://localhost:${port}`));
