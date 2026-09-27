import { z } from "zod";
import type { ActiveSession } from "./infrai_sessions.js";

export const cleanupRequestSchema = z.object({
  user_id: z.string().min(1),
  current_session_id: z.string().min(1),
  appointment: z.object({
    appointment_id: z.string().min(1),
    starts_at: z.string().datetime(),
    status: z.enum(["scheduled", "checked_in", "completed", "cancelled"])
  }).optional()
}).strict();

export type CleanupRequest = z.infer<typeof cleanupRequestSchema>;

export type CleanupResult = {
  kept_session_id: string;
  revoked_session_ids: string[];
  notification: {
    kind: "security_update";
    message: string;
    appointment_id?: string;
  };
};

export function chooseOtherActiveSessions(
  sessions: ActiveSession[],
  currentSessionId: string
): string[] {
  return sessions
    .filter((session) => session.session_id !== currentSessionId)
    .map((session) => session.session_id);
}

function patientSafeNotification(input: CleanupRequest, count: number): CleanupResult["notification"] {
  const base = count === 1
    ? "Signed out 1 other device."
    : `Signed out ${count} other devices.`;

  if (input.appointment && ["scheduled", "checked_in"].includes(input.appointment.status)) {
    return {
      kind: "security_update",
      message: `${base} Your appointment access on this device stays active.`,
      appointment_id: input.appointment.appointment_id
    };
  }
  return { kind: "security_update", message: `${base} This device stays signed in.` };
}

export async function cleanUpOtherSessions(
  input: CleanupRequest,
  sessions: Pick<import("./infrai_sessions.js").InfraiSessions, "listForUser" | "revoke">
): Promise<CleanupResult> {
  const active = await sessions.listForUser(input.user_id);
  const targets = chooseOtherActiveSessions(active, input.current_session_id);
  await Promise.all(targets.map((sessionId) => sessions.revoke(sessionId)));

  return {
    kept_session_id: input.current_session_id,
    revoked_session_ids: targets,
    notification: patientSafeNotification(input, targets.length)
  };
}
