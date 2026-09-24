import { Test } from '@nestjs/testing';
import { BookingsService } from '../src/bookings/bookings.service';
import { DbModule } from '../src/db/db.module';
import { pool } from '../src/db/pool';

/**
 * This is the test that proves the required scenario from the brief:
 * "at most one user can end up with a confirmed booking for the last
 * available seat."
 *
 * Class B (from seed) has exactly 3 confirmed bookings out of capacity 4
 * -> exactly 1 seat left. We create N pending bookings for N different
 * students against that class, then fire all their payments at once
 * with Promise.all. If the FOR UPDATE lock in BookingsService.payBooking
 * works, exactly 1 of them ends up confirmed and the rest end up
 * cancelled (class_full) — never more than 1, and the roster never
 * exceeds capacity.
 */
describe('Last-seat race', () => {
  let bookingsService: BookingsService;
  let classId: number;
  let studentIds: number[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DbModule],
      providers: [BookingsService],
    }).compile();

    bookingsService = moduleRef.get(BookingsService);
  });

  beforeEach(async () => {
    // Fresh parent/students/class per test run so tests don't collide
    // with each other or with the main seed data.
    const parent = await pool.query(
      `INSERT INTO parents (name, email) VALUES ('Race Test Parent', 'race-' || floor(random()*1000000) || '@test.local') RETURNING id`,
    );
    const parentId = parent.rows[0].id;

    const klass = await pool.query(
      `INSERT INTO trial_classes (title, starts_at, capacity) VALUES ('Race Test Class', now() + interval '1 day', 4) RETURNING id`,
    );
    classId = klass.rows[0].id;

    // Pre-fill 3 confirmed seats, leaving exactly 1 open.
    const filler = await pool.query(
      `INSERT INTO students (parent_id, name) SELECT $1, 'Filler ' || g FROM generate_series(1, 3) g RETURNING id`,
      [parentId],
    );
    for (let i = 0; i < 3; i++) {
      await pool.query(
        `INSERT INTO bookings (student_id, class_id, status, seat_no) VALUES ($1, $2, 'confirmed', $3)`,
        [filler.rows[i].id, classId, i + 1],
      );
    }

    // 10 contenders for the last seat.
    const contenders = await pool.query(
      `INSERT INTO students (parent_id, name) SELECT $1, 'Contender ' || g FROM generate_series(1, 10) g RETURNING id`,
      [parentId],
    );
    studentIds = contenders.rows.map((r) => r.id);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('confirms exactly one contender when 10 pay concurrently for the last seat', async () => {
    const bookings = await Promise.all(
      studentIds.map((sid) => bookingsService.createBooking(sid, classId)),
    );
    expect(bookings.every((b) => b.status === 'pending_payment')).toBe(true);

    // Fire all 10 payments at the same time — this is the actual race.
    const results = await Promise.all(
      bookings.map((b, i) =>
        bookingsService.payBooking(b.id, `race-key-${b.id}-${i}`, 'success'),
      ),
    );

    const confirmed = results.filter((r) => r.status === 'confirmed');
    const cancelled = results.filter((r) => r.status === 'cancelled');

    expect(confirmed.length).toBe(1);
    expect(cancelled.length).toBe(9);
    expect(cancelled.every((r) => r.cancel_reason === 'class_full')).toBe(true);

    // Roster must never exceed capacity.
    const rosterCount = await pool.query(
      `SELECT COUNT(*)::int AS n FROM bookings WHERE class_id = $1 AND status = 'confirmed'`,
      [classId],
    );
    expect(rosterCount.rows[0].n).toBe(4); // 3 pre-filled + this 1 winner

    // Seat numbers must be unique among confirmed bookings for the class
    // (belt-and-braces check on top of the DB's own unique index).
    const seats = await pool.query(
      `SELECT seat_no FROM bookings WHERE class_id = $1 AND status = 'confirmed'`,
      [classId],
    );
    const seatNumbers = seats.rows.map((r) => r.seat_no);
    expect(new Set(seatNumbers).size).toBe(seatNumbers.length);
  });

  it('handles two users racing sequentially (the exact scenario in the brief)', async () => {
    const [studentA, studentB] = studentIds;

    // 1. User A selects the last slot, moves to payment (booking created,
    //    still pending — no seat taken yet).
    const bookingA = await bookingsService.createBooking(studentA, classId);

    // 2. User B selects the same slot.
    const bookingB = await bookingsService.createBooking(studentB, classId);

    // 3. User B completes payment first.
    const resultB = await bookingsService.payBooking(bookingB.id, `seq-b-${bookingB.id}`, 'success');
    expect(resultB.status).toBe('confirmed');

    // 4. User A then tries to pay.
    const resultA = await bookingsService.payBooking(bookingA.id, `seq-a-${bookingA.id}`, 'success');
    expect(resultA.status).toBe('cancelled');
    expect(resultA.cancel_reason).toBe('class_full');
  });
});
