import 'dotenv/config';
import { Pool } from 'pg';

// A single shared pool for the whole app. maxed at 10 so the concurrent
// last-seat-race test (10 parallel payment attempts) can actually run
// concurrently instead of queuing on the pool itself.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
