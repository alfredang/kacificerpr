import { resolveIntegration } from "@/server/services/settings";

const BASE = "https://app.asana.com/api/1.0";

export type AsanaTask = { gid: string; name: string; completed: boolean; completed_at?: string | null; permalink_url?: string; due_on?: string | null; notes?: string; modified_at?: string; assignee?: { name: string } | null; memberships?: { section?: { name: string } | null }[] };
const TASK_FIELDS = "name,completed,completed_at,permalink_url,due_on,notes,modified_at,assignee.name,memberships.section.name";

async function client() {
  const cfg = await resolveIntegration("asana");
  const mock = process.env.INTEGRATIONS_MOCK === "1";
  return { ...cfg, mock, enabled: cfg.enabled || mock };
}

async function call<T>(pat: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${pat}`, "content-type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!res.ok) throw new Error(json.errors?.[0]?.message ?? `Asana ${res.status}`);
  return json.data as T;
}

export async function asanaEnabled() {
  return (await client()).enabled;
}

export async function createAsanaTask(input: { name: string; notes: string; dueOn?: string | null }) {
  const c = await client();
  if (!c.enabled) return null;
  if (c.mock || !c.secret) return { gid: `mock-${Date.now()}`, permalink_url: "https://app.asana.com/mock" };
  const body: Record<string, unknown> = { name: input.name, notes: input.notes };
  if (input.dueOn) body.due_on = input.dueOn;
  if (c.config.projectGid) body.projects = [c.config.projectGid];
  else if (c.config.workspaceGid) {
    body.workspace = c.config.workspaceGid;
    body.assignee = "me";
  } else throw new Error("Asana needs a project GID or workspace GID");
  return call<{ gid: string; permalink_url?: string }>(c.secret, "/tasks", { method: "POST", body: JSON.stringify({ data: body }) });
}

export async function completeAsanaTask(gid: string, comment?: string) {
  const c = await client();
  if (!c.enabled || c.mock || !c.secret || gid.startsWith("mock-")) return;
  if (comment) await call(c.secret, `/tasks/${gid}/stories`, { method: "POST", body: JSON.stringify({ data: { text: comment } }) });
  await call(c.secret, `/tasks/${gid}`, { method: "PUT", body: JSON.stringify({ data: { completed: true } }) });
}

export async function commentAsanaTask(gid: string, text: string) {
  const c = await client();
  if (!c.enabled || c.mock || !c.secret || gid.startsWith("mock-")) return;
  await call(c.secret, `/tasks/${gid}/stories`, { method: "POST", body: JSON.stringify({ data: { text } }) });
}

export async function getAsanaTask(gid: string): Promise<AsanaTask | null> {
  const c = await client();
  if (!c.enabled || c.mock || !c.secret || gid.startsWith("mock-")) return null;
  try {
    return await call<AsanaTask>(c.secret, `/tasks/${gid}?opt_fields=${TASK_FIELDS}`);
  } catch {
    return null;
  }
}

export async function listProjectTasks(limit = 100): Promise<AsanaTask[]> {
  const c = await client();
  if (!c.enabled || c.mock || !c.secret || !c.config.projectGid) return [];
  try {
    return await call<AsanaTask[]>(c.secret, `/projects/${c.config.projectGid}/tasks?opt_fields=${TASK_FIELDS}&limit=${limit}`);
  } catch {
    return [];
  }
}

export async function asanaProjectGid() {
  return (await client()).config.projectGid ?? "";
}

const DEFAULT_PROJECT_NAME = "Kacific ERP — PO approvals";

/* Personal Asana workspaces have no teams, so projects are created with
   `workspace`; organisations need `team`. Both are handled here. */
export async function ensureAsanaProject(pat: string, workspaceGid: string) {
  const existing = await call<{ gid: string; name: string }[]>(pat, `/projects?workspace=${workspaceGid}&archived=false&opt_fields=name&limit=100`);
  const found = existing.find((p) => p.name === DEFAULT_PROJECT_NAME);
  if (found) return { gid: found.gid, created: false };
  const ws = await call<{ is_organization: boolean }>(pat, `/workspaces/${workspaceGid}?opt_fields=is_organization`);
  const data: Record<string, unknown> = {
    name: DEFAULT_PROJECT_NAME,
    notes: "Purchase-order approval tasks created automatically by Kacific ERP. A task is created when a PO is submitted and completed when it is approved or rejected; completing a task in Asana approves the PO on the next sync.",
    default_view: "board",
    color: "dark-blue",
  };
  if (ws.is_organization) {
    const teams = await call<{ gid: string }[]>(pat, `/organizations/${workspaceGid}/teams?limit=1`);
    if (!teams[0]) throw new Error("No team found in the Asana organisation to own the project");
    data.team = teams[0].gid;
  } else {
    data.workspace = workspaceGid;
  }
  const project = await call<{ gid: string }>(pat, "/projects", { method: "POST", body: JSON.stringify({ data }) });
  for (const name of ["Awaiting approval", "Approved", "Ordered", "Done"]) {
    await call(pat, `/projects/${project.gid}/sections`, { method: "POST", body: JSON.stringify({ data: { name } }) }).catch(() => {});
  }
  return { gid: project.gid, created: true };
}

/* Test connection also self-configures: resolves the workspace from the PAT
   when none is set and creates the approvals project when none is set. The
   returned `config` patch is persisted by the settings action. */
export async function testAsana(pat: string, config: Record<string, string>) {
  try {
    const me = await call<{ name: string; email: string; workspaces: { gid: string; name: string }[] }>(pat, "/users/me?opt_fields=name,email,workspaces.name");
    const patch: Record<string, string> = {};
    let workspaceGid = config.workspaceGid;
    if (!workspaceGid) {
      workspaceGid = me.workspaces[0]?.gid ?? "";
      if (workspaceGid) patch.workspaceGid = workspaceGid;
    }
    let project = "";
    if (config.projectGid) {
      const p = await call<{ name: string }>(pat, `/projects/${config.projectGid}?opt_fields=name`);
      project = ` · project “${p.name}”`;
    } else if (workspaceGid) {
      const ensured = await ensureAsanaProject(pat, workspaceGid);
      patch.projectGid = ensured.gid;
      project = ` · ${ensured.created ? "created" : "found"} project “${DEFAULT_PROJECT_NAME}” (${ensured.gid})`;
    }
    return { ok: true, message: `Connected as ${me.name} (${me.email})${project}`, patch };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err), patch: {} };
  }
}
