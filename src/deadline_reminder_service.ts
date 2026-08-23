import { createServer, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { ZodError } from "zod";
import { InfraiError, infrai } from "./infrai_cron.js";
import { planDeadlineReminders, reminderRequestSchema } from "./reminder_plan.js";

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function scheduleDeadlineReminders(body: unknown) {
  const input = reminderRequestSchema.parse(body);
  const plan = planDeadlineReminders(input);
  const scheduled = await Promise.all(
    plan.schedules.map(async (schedule) => {
      const result = await infrai.cron.create(
        { cron_expr: schedule.cronExpr, task: schedule.taskUrl },
        `${plan.courseId}:${plan.learnerId}:${schedule.kind}:${schedule.cronExpr}`
      );
      return { kind: schedule.kind, jobId: result.job_id, cronExpr: schedule.cronExpr };
    })
  );
  return { courseId: plan.courseId, learnerId: plan.learnerId, scheduled };
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/reminders") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    send(response, 201, await scheduleDeadlineReminders(await readJson(request)));
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "Invalid reminder request", issues: error.issues });
    } else if (error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must be valid JSON" });
    } else if (error instanceof InfraiError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        message: error.message
      });
    } else {
      send(response, 500, { error: "Unable to schedule reminders" });
    }
  }
});

const exampleRequest = {
  course: {
    courseId: "typescript-201",
    title: "Tool-Oriented TypeScript",
    deliveredAt: "2026-09-01T09:00:00.000Z"
  },
  learnerDeadline: {
    learnerId: "learner-42",
    dueAt: "2026-09-08T17:00:00.000Z",
    reminderTaskUrl: "https://school.example/hooks/learner-reminder"
  },
  educatorReporting: {
    reportTaskUrl: "https://school.example/hooks/deadline-report"
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--example")) {
    console.log(JSON.stringify(planDeadlineReminders(reminderRequestSchema.parse(exampleRequest)), null, 2));
  } else {
    const port = Number(process.env.PORT ?? 3000);
    server.listen(port, () => console.log(`Reminder service listening on http://localhost:${port}`));
  }
}
