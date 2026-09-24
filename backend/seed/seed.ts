import { pool } from '../src/db/pool';

/**
 * Seed data covers the 4 required cases from the brief:
 *  - a class with available seats       -> Class A
 *  - a class with exactly 3 confirmed   -> Class B (for the last-seat race demo)
 *  - a class that's already full        -> Class C
 *  - a duplicate booking attempt        -> Budi is already confirmed in Class B
 *  - a payment failure case             -> Sari has a failed payment_attempt
 */
async function main() {
  await pool.query('BEGIN');
  try {
    await pool.query(`
      TRUNCATE payment_attempts, bookings, trial_classes, students, parents
      RESTART IDENTITY CASCADE
    `);

    const parents = await pool.query(`
      INSERT INTO parents (name, email) VALUES
        ('Rina Wijaya', 'rina@example.com'),
        ('Andi Saputra', 'andi@example.com'),
        ('Maya Putri', 'maya@example.com')
      RETURNING id
    `);
    const [p1, p2, p3] = parents.rows.map((r) => r.id);

    const students = await pool.query(
      `INSERT INTO students (parent_id, name) VALUES
        ($1, 'Budi'),
        ($1, 'Dewi'),
        ($2, 'Sari'),
        ($2, 'Andi Jr'),
        ($3, 'Rina Jr'),
        ($3, 'Tono')
      RETURNING id`,
      [p1, p2, p3],
    );
    const [budi, dewi, sari, andiJr, rinaJr, tono] = students.rows.map((r) => r.id);

    const classes = await pool.query(`
      INSERT INTO trial_classes (title, subject, starts_at, capacity) VALUES
        ('Math Trial - Saturday 10:00', 'math', now() + interval '3 days', 4),
        ('Science Trial - Sunday 09:00', 'science', now() + interval '4 days', 4),
        ('Coding Trial - Monday 16:00', 'coding', now() + interval '5 days', 4)
      RETURNING id
    `);
    const [classA, classB, classC] = classes.rows.map((r) => r.id);

    // Class A: 1 confirmed, plenty of seats left
    await pool.query(
      `INSERT INTO bookings (student_id, class_id, status, seat_no) VALUES ($1, $2, 'confirmed', 1)`,
      [dewi, classA],
    );

    // Class B: exactly 3 confirmed — one seat left, used for the last-seat race demo
    await pool.query(
      `INSERT INTO bookings (student_id, class_id, status, seat_no) VALUES
        ($1, $4, 'confirmed', 1),
        ($2, $4, 'confirmed', 2),
        ($3, $4, 'confirmed', 3)`,
      [budi, andiJr, rinaJr, classB],
    );
    // Budi is already confirmed in Class B -> use this to demo the duplicate-booking case

    // Class C: full (4 confirmed)
    await pool.query(
      `INSERT INTO bookings (student_id, class_id, status, seat_no) VALUES
        ($1, $5, 'confirmed', 1),
        ($2, $5, 'confirmed', 2),
        ($3, $5, 'confirmed', 3),
        ($4, $5, 'confirmed', 4)`,
      [budi, dewi, andiJr, rinaJr, classC],
    );
    // Note: reusing budi/dewi/andiJr/rinaJr here is fine — the unique
    // constraint is per (student_id, class_id), and this is a different
    // class_id (classC) than their other bookings above.

    // Sari: a failed payment attempt against Class A (still has seats)
    const sariBooking = await pool.query(
      `INSERT INTO bookings (student_id, class_id, status) VALUES ($1, $2, 'payment_failed') RETURNING id`,
      [sari, classA],
    );
    await pool.query(
      `INSERT INTO payment_attempts (booking_id, idempotency_key, status, failure_reason) VALUES ($1, $2, 'failed', 'card_declined')`,
      [sariBooking.rows[0].id, `seed-fail-${sariBooking.rows[0].id}`],
    );

    await pool.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('Seed complete.');
    // eslint-disable-next-line no-console
    console.log({ classA, classB, classC, budi, dewi, sari, andiJr, rinaJr, tono });
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
