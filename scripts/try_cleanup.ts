const response = await fetch("http://localhost:3000/session-cleanup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    user_id: "patient_42",
    current_session_id: "session_phone",
    appointment: {
      appointment_id: "appointment_204",
      starts_at: "2026-09-15T09:30:00.000Z",
      status: "scheduled"
    }
  })
});

console.log(JSON.stringify(await response.json(), null, 2));
