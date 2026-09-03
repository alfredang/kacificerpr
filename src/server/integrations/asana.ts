import { resolveIntegration } from "@/server/services/settings";

const BASE = "https://app.asana.com/api/1.0";

export type AsanaTask = { gid: string; name: string; completed: boolean; permalink_url?: string; due_on?: string | null };

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
    return await call<AsanaTask>(c.secret, `/tasks/${gid}?opt_fields=name,completed,permalink_url,due_on`);
  } catch {
    return null;
  }
}

export async function listProjectTasks(limit = 50): Promise<AsanaTask[]> {
  const c = await client();
  if (!c.enabled || c.mock || !c.secret || !c.config.projectGid) return [];
  try {
    return await call<AsanaTask[]>(c.secret, `/projects/${c.config.projectGid}/tasks?opt_fields=name,completed,permalink_url,due_on&limit=${limit}`);
  } catch {
    return [];
  }
}

export async function testAsana(pat: string, config: Record<string, string>) {
  try {
    const me = await call<{ name: string; email: string }>(pat, "/users/me");
    let project = "";
    if (config.projectGid) {
      const p = await call<{ name: string }>(pat, `/projects/${config.projectGid}?opt_fields=name`);
      project = ` · project “${p.name}”`;
    }
    return { ok: true, message: `Connected as ${me.name} (${me.email})${project}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
