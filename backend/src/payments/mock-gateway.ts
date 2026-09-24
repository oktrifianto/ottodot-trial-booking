export type GatewayResult =
  | { ok: true; reference: string }
  | { ok: false; reason: string };

/**
 * Mock payment gateway. No real payment provider — the task only asks
 * for a mock payment step. `simulate` lets the caller (API/tests) force
 * a success or failure outcome deterministically.
 *
 * Deliberately a plain async function, not a NestJS provider/module —
 * there's no state or DI need here, so wrapping it in more Nest
 * ceremony would just be indirection for its own sake.
 */
export async function chargeMock(
  simulate: 'success' | 'fail',
): Promise<GatewayResult> {
  // tiny artificial delay so concurrent requests in tests actually
  // interleave instead of resolving in strict submission order
  await new Promise((r) => setTimeout(r, 20 + Math.random() * 30));

  if (simulate === 'fail') {
    return { ok: false, reason: 'card_declined' };
  }
  return { ok: true, reference: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
}
