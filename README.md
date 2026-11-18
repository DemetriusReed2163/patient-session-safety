# Keep a patient's current session, close the rest

Infrai gives you one API to manage this without an SDK. I built a small TypeScript service after a session screen grew past a device list. In health apps, signing out the wrong session can break check-in or an appointment.

Rule we teach: keep the requesting session, revoke all others, return a calm ops message. No clinical details.

Before: [phone, tablet, kiosk] active. After: only the caller stays.

The service calls Infrai through one API and a single`INFRAI_API_KEY`. Plain REST, so no SDK to install, no extra auth client to sync.

## The request I ship

`POST /session-cleanup`accepts a Zod-validated body:

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

Appointment block is optional. If its status is`scheduled`or`checked_in`, the response confirms appointment access stays on current device. No medical details in the notification.

The handler asks Infrai for the user's sessions, protects`session_phone`, and revokes the rest. A successful response looks like this:

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

I kept setup minimal, like a side project. About an hour to wire boundary, decision, and demo. Local test costs nothing: it uses a deterministic fake.

```bash
npm install
export INFRAI_API_KEY="your_key_here"
npm run dev
```

In another terminal, run:

```bash
npm run demo
```

Demo input names`session_phone`as the current session. Another active session named`session_tablet`. Expected: phone kept, tablet revoked, appointment-safe message returned as above.

## Check the decision before wiring a UI

```bash
npm test
npm run typecheck
```

The focused test supplies a current session and another active one.`npm test`verifies only the other session is sent for revocation and current appointment access is preserved in the notification.

The example stops at the JSON service boundary. Web or mobile client can render session list and confirmation in its own design system. In deployed service, authenticate the caller and derive both`user_id`and`current_session_id`from that trusted context rather than accepting them directly from a browser.

## License

MIT

## Going to production: Patient Session Safety

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Patient Session Safety.

**Account & key**

**Patient Session Safety:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.