export async function register() {
  // App-local no-op: shadows the fork-root instrumentation.ts (upstream
  // Sentry wiring for the root dev app). Turbopack resolves instrumentation
  // from the configured turbopack root; without this file the upstream one
  // is picked up and fails to resolve its sibling sentry configs.
}
