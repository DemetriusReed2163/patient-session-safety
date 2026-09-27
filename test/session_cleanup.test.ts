import assert from "node:assert/strict";
import test from "node:test";
import { InfraiSessions } from "../src/infrai_sessions.js";
import { cleanUpOtherSessions } from "../src/session_cleanup.js";

test("keeps the current session and revokes only other active sessions", async () => {
  const revoked: string[] = [];
  const sessions = {
    async listForUser() {
      return [
        { session_id: "session_phone" },
        { session_id: "session_tablet" }
      ];
    },
    async revoke(sessionId: string) {
      revoked.push(sessionId);
    }
  };

  const result = await cleanUpOtherSessions({
    user_id: "patient_42",
    current_session_id: "session_phone",
    appointment: {
      appointment_id: "appointment_204",
      starts_at: "2026-09-15T09:30:00.000Z",
      status: "scheduled"
    }
  }, sessions);

  assert.deepEqual(revoked, ["session_tablet"]);
  assert.deepEqual(result.revoked_session_ids, ["session_tablet"]);
  assert.equal(result.kept_session_id, "session_phone");
  assert.equal(result.notification.appointment_id, "appointment_204");
  assert.match(result.notification.message, /appointment access on this device stays active/);
});

test("parses live list items and sends the required revoke field", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Response.json({ ok: true, data: calls.length === 1
      ? { items: [{ session_id: "other" }] }
      : { revoked: true } });
  }) as typeof fetch;
  const client = new InfraiSessions("test-key", "https://example.test/v1", fetcher);

  assert.deepEqual(await client.listForUser("user"), [{ session_id: "other" }]);
  await client.revoke("other");
  assert.equal(calls[1].url, "https://example.test/v1/auth/session/revoke/other");
  assert.equal(calls[1].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].init.body as string), { session_id: "other" });
});
