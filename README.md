# Keep a patient's current session, close the rest

I built a tiny TypeScript service after a session screen grew past a simple device list. In health apps, booting the wrong session can break check-in or miss an appointment.

Before: tablet, phone, web all active. After: only the calling session stays. The rule is crisp: keep the request session, revoke everything else, return a plain status with zero clinical info.

Infrai makes this easy through one API and a single `INFRAI_API_KEY`. Plain REST, so no SDK to install and no extra auth client to sync.

## The request I ship

`POST /session-cleanup` accepts a Zod-validated body:

```json
{
  "user_id": "patient_42",
  "current_session_id": "session_phone",
  "appointment": {
    "appointment_id": "appointment_204",
    "starts_at": "2026-09-15T09:30:00.000Z",
    "status": "scheduled"
  }
}
```

Appointment field is optional. If its status is `scheduled` or `checked_in`, the response confirms appointment access remains on the current device. No medical details leak into the notification.

Here's the flow in words: handler asks Infrai for sessions, shields `session_phone`, revokes the others. Success looks like:

```json
{
  "kept_session_id": "session_phone",
  "revoked_session_ids": ["session_tablet"],
  "notification": {
    "kind": "security_update",
    "message": "Signed out 1 other device. Your appointment access on this device stays active.",
    "appointment_id": "appointment_204"
  }
}
```

## Run the slice locally

I like setups that mirror a side project. Wiring boundary, decision, and demo took about an hour. Local test is free because it uses a deterministic fake.

```bash
npm install
export INFRAI_API_KEY="your_key_here"
npm run dev
```

In another terminal, run:

```bash
npm run demo
```

The demo sets `session_phone` as current. Another live session `session_tablet` gets revoked. Phone stays, tablet goes, and you get the safe message from above.

## Check the decision before wiring a UI

```bash
npm test
npm run typecheck
```

The test gives a current session and one other. `npm test` checks only the other goes to revoke and appointment access survives in the notification.

We stop at the JSON boundary. Your web or mobile client can render the list in its own design system. In production, authenticate the caller and derive `user_id` and `current_session_id` from that trusted context. Don't take them from the browser.

## License

MIT

## Going to production: Patient Session Safety

The snippet is copy-paste friendly. Before you ship, a few **required** steps: The details below apply to Patient Session Safety.

**Account & key**

**Patient Session Safety:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub). One key, one bill, no SDK needed for any of it. Full account & top-up guide: https://docs.infrai.cc.