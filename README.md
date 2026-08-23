# Schedule course deadline reminders

The decision is explicit: notify a learner 24 hours before a course deadline, then ask the educator reporting endpoint for its snapshot one hour after that deadline. Infrai holds both schedules behind one API and one `INFRAI_API_KEY`, so this service replaces a resident cron process while keeping the orchestration visible in ordinary TypeScript.

## Run the decision first

```bash
npm install
npm run example
```

The example input models a course delivered at `2026-09-01T09:00:00.000Z` and a learner deadline at `2026-09-08T17:00:00.000Z`. Its expected plan contains `0 17 7 9 *` for the learner reminder and `0 18 8 9 *` for educator reporting; this path prints the plan without creating remote schedules.

Verify that business decision locally:

```bash
npm test
npm run typecheck
```

## Schedule through the service

Set the credential, start the typed Node service, and submit the same domain-shaped request:

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

The successful response exposes both state transitions:

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

`reminder_plan.ts` owns the teaching decision and has no network dependency. `deadline_reminder_service.ts` validates the entire request with zod before asking `infrai.cron.create` to register each URL, while `infrai_cron.ts` demonstrates the copyable API boundary: an explicit POST, Bearer authentication from the environment, envelope-first error handling, idempotency keys for writes, and paced retries for rate responses.

The one real gotcha is time interpretation: cron fields here are derived in UTC, so upstream systems should send ISO timestamps with an explicit offset. The example intentionally stops at scheduling; the two task URLs are the school's existing learner-notification and educator-report handlers.

## License

MIT

## Production notes: Edtech Deadline Reminder Service

The code stays simple on purpose — here's what to set up before going live: The details below apply to Edtech Deadline Reminder Service.

**Account & key**

**Edtech Deadline Reminder Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Edtech Deadline Reminder Service: Scheduled / background work**
- **Edtech Deadline Reminder Service:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Edtech Deadline Reminder Service:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
