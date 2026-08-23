import { z } from "zod";

export const reminderRequestSchema = z.object({
  course: z.object({
    courseId: z.string().min(1),
    title: z.string().min(1),
    deliveredAt: z.string().datetime({ offset: true })
  }),
  learnerDeadline: z.object({
    learnerId: z.string().min(1),
    dueAt: z.string().datetime({ offset: true }),
    reminderTaskUrl: z.string().url()
  }),
  educatorReporting: z.object({
    reportTaskUrl: z.string().url()
  })
}).superRefine((request, context) => {
  if (Date.parse(request.learnerDeadline.dueAt) <= Date.parse(request.course.deliveredAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["learnerDeadline", "dueAt"],
      message: "The learner deadline must follow course delivery"
    });
  }
});

export type ReminderRequest = z.infer<typeof reminderRequestSchema>;

export type ReminderPlan = {
  courseId: string;
  learnerId: string;
  schedules: {
    kind: "learner-reminder" | "educator-report";
    cronExpr: string;
    taskUrl: string;
  }[];
};

function onceAt(date: Date): string {
  return `${date.getUTCMinutes()} ${date.getUTCHours()} ${date.getUTCDate()} ${date.getUTCMonth() + 1} *`;
}

export function planDeadlineReminders(request: ReminderRequest): ReminderPlan {
  const dueAt = new Date(request.learnerDeadline.dueAt);
  const learnerReminderAt = new Date(dueAt.getTime() - 24 * 60 * 60 * 1000);
  const educatorReportAt = new Date(dueAt.getTime() + 60 * 60 * 1000);

  return {
    courseId: request.course.courseId,
    learnerId: request.learnerDeadline.learnerId,
    schedules: [
      {
        kind: "learner-reminder",
        cronExpr: onceAt(learnerReminderAt),
        taskUrl: request.learnerDeadline.reminderTaskUrl
      },
      {
        kind: "educator-report",
        cronExpr: onceAt(educatorReportAt),
        taskUrl: request.educatorReporting.reportTaskUrl
      }
    ]
  };
}
