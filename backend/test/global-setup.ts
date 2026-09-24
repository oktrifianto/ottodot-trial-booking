import { Client } from 'pg';
import 'dotenv/config';

// Intended for reset data test before running the test using `pnpm test`
// it will remove existing test data from the database to ensure a clean state for the tests
module.exports = async function globalSetup() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`DELETE FROM payment_attempts WHERE booking_id IN (
    SELECT id FROM bookings WHERE class_id IN (
      SELECT id FROM trial_classes WHERE title IN ('Race Test Class', 'Test Class')
    )
  )`);

  await client.query(`DELETE FROM bookings WHERE class_id IN (
    SELECT id FROM trial_classes WHERE title IN ('Race Test Class', 'Test Class')
  )`);

  await client.query(`DELETE FROM students WHERE parent_id IN (
    SELECT id FROM parents WHERE email LIKE 'race-%@test.local' OR email LIKE 'test-%@test.local'
  )`);

  await client.query(`DELETE FROM parents WHERE email LIKE 'race-%@test.local' OR email LIKE 'test-%@test.local'`);
  await client.query(`DELETE FROM trial_classes WHERE title IN ('Race Test Class', 'Test Class')`);
  await client.end();
};
