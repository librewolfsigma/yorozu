// Next.js instrumentation hook — starts the in-process metadata sync
// scheduler exactly once per server process (nodejs runtime only).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startSyncScheduler } = await import("@/lib/sync");
  startSyncScheduler();
}
