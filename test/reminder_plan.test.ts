import assert from "node:assert/strict";
import test from "node:test";
import { planDeadlineReminders, reminderRequestSchema } from "../src/reminder_plan.js";

test("places the learner reminder before the deadline and reporting after it", () => {
  const request = reminderRequestSchema.parse({
    course: {
      courseId: "agents-101",
      title: "Agent Tools",
      deliveredAt: "2026-09-01T09:00:00.000Z"
    },
    learnerDeadline: {
      learnerId: "learner-7",
      dueAt: "2026-09-08T17:00:00.000Z",
      reminderTaskUrl: "https://school.example/hooks/remind"
    },
    educatorReporting: { reportTaskUrl: "https://school.example/hooks/report" }
  });

  assert.deepEqual(planDeadlineReminders(request).schedules, [
    {
      kind: "learner-reminder",
      cronExpr: "0 17 7 9 *",
      taskUrl: "https://school.example/hooks/remind"
    },
    {
      kind: "educator-report",
      cronExpr: "0 18 8 9 *",
      taskUrl: "https://school.example/hooks/report"
    }
  ]);
});

test("rejects a deadline that precedes course delivery", () => {
  const result = reminderRequestSchema.safeParse({
    course: { courseId: "agents-101", title: "Agent Tools", deliveredAt: "2026-09-02T09:00:00.000Z" },
    learnerDeadline: {
      learnerId: "learner-7",
      dueAt: "2026-09-01T17:00:00.000Z",
      reminderTaskUrl: "https://school.example/hooks/remind"
    },
    educatorReporting: { reportTaskUrl: "https://school.example/hooks/report" }
  });

  assert.equal(result.success, false);
});
