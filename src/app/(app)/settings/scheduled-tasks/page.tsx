import { requireAction } from "@/server/auth/session";
import { describeCron, listTasks, nextRuns } from "@/server/services/tasks";
import { TaskButtons, TaskForm } from "@/components/settings/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import { dateTime } from "@/lib/format";
import { TASK_KIND_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  await requireAction("settings.manage");
  const tasks = await listTasks();
  return (
    <div className="space-y-5">
      <Alert tone="info">The scheduler is driven by <code>GET /api/cron/tick</code> every 5 minutes (Vercel Cron, the Docker sidecar, or <code>pnpm cron:tick</code> locally). A task runs on the first tick after its next scheduled time; “Run now” executes it immediately.</Alert>
      <Card>
        <CardHeader title="Add a scheduled task" />
        <CardBody><TaskForm /></CardBody>
      </Card>
      {tasks.map((t) => (
        <Card key={t.id}>
          <CardHeader
            title={<span className="flex items-center gap-2">{t.name} <Badge tone={t.enabled ? "ok" : "neutral"}>{t.enabled ? "enabled" : "paused"}</Badge>{t.lastStatus ? <Badge tone={t.lastStatus === "ok" ? "ok" : "bad"}>last run {t.lastStatus}</Badge> : null}</span>}
            subtitle={`${TASK_KIND_LABEL[t.kind]} · ${describeCron(t.cronExpr)} (${t.cronExpr}, ${t.timezone}) · next: ${nextRuns(t.cronExpr, t.timezone, 3).map((d) => dateTime(d)).join(" · ")}`}
            actions={<TaskButtons id={t.id} />}
          />
          <CardBody><TaskForm task={t} /></CardBody>
          {t.runs.length ? (
            <CardBody className="border-t border-line">
              <p className="mb-2 text-[12px] font-medium uppercase text-ink-soft">Recent runs</p>
              <ul className="space-y-1 text-[12.5px]">
                {t.runs.map((r) => <li key={r.id} className="flex gap-3"><span className="w-36 shrink-0 text-ink-faint">{dateTime(r.startedAt)}</span><Badge tone={r.status === "ok" ? "ok" : r.status === "failed" ? "bad" : "neutral"}>{r.status}</Badge><span className="text-ink-faint">{r.trigger}</span><span className="text-ink-soft">{r.log}</span></li>)}
              </ul>
            </CardBody>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
