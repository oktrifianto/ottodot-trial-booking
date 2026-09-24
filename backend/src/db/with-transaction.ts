import { Pool, PoolClient } from 'pg';

/**
 * Runs `fn` inside a BEGIN/COMMIT transaction on a dedicated client.
 * Rolls back on any error. Always releases the client back to the pool.
 *
 * Kept deliberately small and explicit (no ORM) so the locking behaviour
 * used by BookingsService — SELECT ... FOR UPDATE — is easy to read and
 * verify, since that's the part this take-home is actually testing.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
