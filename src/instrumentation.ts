// Next.js instrumentation hook.
//
// v2 client-first architecture: there is NO background scheduler. Yozora
// runs no periodic catalog sync, no crosswalk jobs and no import pipelines
// (docs/CLIENT_ARCHITECTURE.md). Provider health is checked on demand from
// the Extensions view or before live searches.
export async function register() {
  // intentionally empty — Yozora is a client, not a database
}
