import "./_env";

/* Fires the scheduler the same way Vercel Cron / the Docker sidecar do. */
async function main() {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/cron/tick`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  const body = await res.text();
  console.log(res.status, body);
  process.exit(res.ok ? 0 : 1);
}
main();
