import { Test } from '@nestjs/testing';
import { BookingsService } from '../src/bookings/bookings.service';
import { DbModule } from '../src/db/db.module';
import { pool } from '../src/db/pool';

describe('BookingsService', () => {
  let bookingsService: BookingsService;
  let parentId: number;
  let classId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DbModule],
      providers: [BookingsService],
    }).compile();
    bookingsService = moduleRef.get(BookingsService);
  });

  beforeEach(async () => {
    const parent = await pool.query(
      `INSERT INTO parents (name, email) VALUES ('Test Parent', 'test-' || floor(random()*1000000) || '@test.local') RETURNING id`,
    );
    parentId = parent.rows[0].id;

    const klass = await pool.query(
      `INSERT INTO trial_classes (title, starts_at, capacity) VALUES ('Test Class', now() + interval '1 day', 4) RETURNING id`,
    );
    classId = klass.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  async function newStudent(name = 'Student') {
    const res = await pool.query(
      `INSERT INTO students (parent_id, name) VALUES ($1, $2) RETURNING id`,
      [parentId, name],
    );
    return res.rows[0].id as number;
  }

  it('books and pays successfully, appearing in the roster', async () => {
    const studentId = await newStudent();
    const booking = await bookingsService.createBooking(studentId, classId);
    expect(booking.status).toBe('pending_payment');

    const paid = await bookingsService.payBooking(booking.id, `key-${booking.id}`, 'success');
    expect(paid.status).toBe('confirmed');
    expect(paid.seat_no).toBe(1);
  });

  it('rejects/dedupes a duplicate booking for the same student and class', async () => {
    const studentId = await newStudent();
    const first = await bookingsService.createBooking(studentId, classId);
    const second = await bookingsService.createBooking(studentId, classId);

    expect(second.id).toBe(first.id); // idempotent — same booking returned, no duplicate row
  });

  it('handles payment failure without adding the child to the roster', async () => {
    const studentId = await newStudent();
    const booking = await bookingsService.createBooking(studentId, classId);

    const failed = await bookingsService.payBooking(booking.id, `key-${booking.id}`, 'fail');
    expect(failed.status).toBe('payment_failed');

    const roster = await pool.query(
      `SELECT * FROM bookings WHERE class_id = $1 AND status = 'confirmed'`,
      [classId],
    );
    expect(roster.rowCount).toBe(0);
  });

  it('allows retrying payment after a failure', async () => {
    const studentId = await newStudent();
    const booking = await bookingsService.createBooking(studentId, classId);

    await bookingsService.payBooking(booking.id, `key-fail-${booking.id}`, 'fail');
    const retried = await bookingsService.payBooking(booking.id, `key-retry-${booking.id}`, 'success');

    expect(retried.status).toBe('confirmed');
  });

  it('rejects payment when the class is already full', async () => {
    // Fill the class to capacity first.
    for (let i = 0; i < 4; i++) {
      const sid = await newStudent(`Filler ${i}`);
      const b = await bookingsService.createBooking(sid, classId);
      await bookingsService.payBooking(b.id, `fill-${b.id}`, 'success');
    }

    const lateStudent = await newStudent('Late Student');
    const lateBooking = await bookingsService.createBooking(lateStudent, classId);
    const result = await bookingsService.payBooking(lateBooking.id, `key-${lateBooking.id}`, 'success');

    expect(result.status).toBe('cancelled');
    expect(result.cancel_reason).toBe('class_full');
  });

  it('is idempotent when the same payment idempotency key is sent twice', async () => {
    const studentId = await newStudent();
    const booking = await bookingsService.createBooking(studentId, classId);
    const key = `dup-key-${booking.id}`;

    const first = await bookingsService.payBooking(booking.id, key, 'success');
    const second = await bookingsService.payBooking(booking.id, key, 'success');

    expect(first.status).toBe('confirmed');
    expect(second.id).toBe(first.id);
    expect(second.status).toBe('confirmed');

    const attempts = await pool.query(
      `SELECT COUNT(*)::int AS n FROM payment_attempts WHERE idempotency_key = $1`,
      [key],
    );
    expect(attempts.rows[0].n).toBe(1); // only one attempt row, no double charge
  });
});
