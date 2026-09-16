/**
 * Test data factories — timestamp-suffixed so specs sharing the single
 * seeded account (see `patterns/e2e.md` § Database CRUD) never collide on a
 * unique constraint. Add a new factory here when a module ships its first
 * spec that needs one; never inline ad-hoc names in a spec that ≥2 tests
 * need (see `E-M1`).
 */

let sequence = 0;

/** `${prefix} ${timestamp}-${suffix}` — the generic unique-label helper. The
 *  suffix keeps two names built in the same millisecond (same test, or two
 *  workers) apart. */
export function uniqueName(prefix: string): string {
  sequence += 1;
  const suffix = `${sequence}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix} ${Date.now()}-${suffix}`;
}

export interface UniqueDeviceInput {
  name: string;
}

/** Device names are unique per account (`DEVICE_NAME_TAKEN`) — always
 *  timestamp them rather than reusing a fixed name across specs. */
export function createUniqueDevice(): UniqueDeviceInput {
  return { name: uniqueName("E2E Device") };
}
