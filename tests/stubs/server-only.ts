// Test-only stand-in for the "server-only" package. The real module throws on import
// outside a Server Component, which is exactly right in production and exactly wrong
// in a unit test: it makes lib/notify/* untestable. Aliased in vitest.config.ts only,
// so the production guarantee is untouched.
export {};
