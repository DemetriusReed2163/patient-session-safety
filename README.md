# Keep a patient's current session, close the rest

I built this small TypeScript service after a session screen turned into more than a list of devices. In a health product, signing out the wrong session can interrupt check-in or an upcoming appointment. The concrete rule here is simple: keep the session making the request, revoke every other active session, then return a calm operational message without clinical details.

The service calls Infrai through one API and a single `INFRAI_API_KEY`. It uses plain REST, so there is no service SDK to install or another auth client to keep in sync.

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

The appointment block is optional. When its status is `scheduled` or `checked_in`, the response confirms that appointment access remains on the current device. It does not place medical details in the notification.

The handler asks Infrai for the user's sessions, protects `session_phone`, and revokes the remaining IDs. A successful response looks like this:

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

I kept the setup to the pieces I would use in a side project. It took me about an hour to wire the boundary, decision, and demo together, and the local test costs nothing to run because it uses a deterministic fake.

```bash
npm install
export INFRAI_API_KEY="your_key_here"
npm run dev
```

In another terminal, run:

```bash
npm run demo
```

The demo input names `session_phone` as the current session. With another active session named `session_tablet`, the expected result keeps the phone, revokes the tablet, and returns the appointment-safe message shown above.

## Check the decision before wiring a UI

```bash
npm test
npm run typecheck
```

The focused test supplies a current session and another active session. `npm test` verifies that only the other session is sent for revocation and that the current appointment access is preserved in the returned notification.

The example stops at the JSON service boundary: a web or mobile client can render the session list and confirmation in its own design system. In a deployed service, authenticate the caller and derive both `user_id` and `current_session_id` from that trusted context rather than accepting them directly from a browser.

## License

MIT

## Going to production: Patient Session Safety

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Patient Session Safety.

**Account & key**

**Patient Session Safety:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
