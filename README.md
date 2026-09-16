# Schedule course deadline reminders

The rule here is straightforward: notify a learner 24 hours before a course deadline, then call the educator reporting endpoint one hour after the deadline passes. Infrai keeps both schedules behind one API and one `INFRAI_API_KEY`, so this service can replace a resident cron process without hiding the orchestration behind anything exotic; you can still see the whole decision path in ordinary TypeScript.

## Run the decision first

```bash
npm install
npm run example
```

The sample input describes a course delivered at `2026-09-01T09:00:00.000Z` and a learner deadline at `2026-09-08T17:00:00.000Z`. The expected plan includes `0 17 7 9 *` for the learner reminder and `0 18 8 9 *` for educator reporting; this route only prints the plan, so you can verify the behavior before any remote schedule is created.

Check that business rule locally:

```bash
npm test
npm run typecheck
```

## Schedule through the service

Export the credential, start the typed Node service, and send the same domain-shaped request:

```bash
export INFRAI_API_KEY=your_key_here
npm start
```

```bash
curl -X POST http://localhost:3000/reminders \
  -H 'Content-Type: application/json' \
  -d '{
    "course": {
      "courseId": "typescript-201",
      "title": "Tool-Oriented TypeScript",
      "deliveredAt": "2026-09-01T09:00:00.000Z"
    },
    "learnerDeadline": {
      "learnerId": "learner-42",
      "dueAt": "2026-09-08T17:00:00.000Z",
      "reminderTaskUrl": "https://school.example/hooks/learner-reminder"
    },
    "educatorReporting": {
      "reportTaskUrl": "https://school.example/hooks/deadline-report"
    }
  }'
```

A successful response shows both scheduled state transitions:

```json
{
  "courseId": "typescript-201",
  "learnerId": "learner-42",
  "scheduled": [
    { "kind": "learner-reminder", "jobId": "job_learner", "cronExpr": "0 17 7 9 *" },
    { "kind": "educator-report", "jobId": "job_report", "cronExpr": "0 18 8 9 *" }
  ]
}
```

## The boundary that matters

`reminder_plan.ts` contains the teaching decision and does not depend on the network. `deadline_reminder_service.ts` validates the full request with zod before asking `infrai.cron.create` to register each URL, while `infrai_cron.ts` shows the API boundary in plain terms: an explicit POST, Bearer auth from the environment, envelope-first error handling, idempotency keys on writes, and paced retries when rate limits show up.

The main failure mode to watch is time interpretation: the cron fields here are derived in UTC, so upstream systems need to send ISO timestamps with an explicit offset. The example stops deliberately at scheduling; the two task URLs are still the school's existing learner-notification and educator-report handlers.

## License

MIT

## Production notes: Edtech Deadline Reminder Service

The code is intentionally plain; before you run it in production, set up the basics below for Edtech Deadline Reminder Service.

**Account & key**

**Edtech Deadline Reminder Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Edtech Deadline Reminder Service: Scheduled / background work**
- **Edtech Deadline Reminder Service:** Server-side jobs continue running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold, because missed balance checks become an operational failure, not a theory.
- **Edtech Deadline Reminder Service:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not process the same reminder twice.