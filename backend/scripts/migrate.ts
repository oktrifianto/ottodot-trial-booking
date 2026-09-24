import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../src/db/pool';

async function main() {
  const sql = readFileSync(join(__dirname, '../migrations/schema.sql'), 'utf-8');
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log('Migration applied.');
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', err);
  process.exit(1);
});
