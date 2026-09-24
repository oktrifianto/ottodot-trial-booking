import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.module';
import { withTransaction } from '../db/with-transaction';
import { chargeMock } from '../payments/mock-gateway';

export type BookingStatus = 'pending_payment' | 'confirmed' | 'payment_failed' | 'cancelled';

export interface Booking {
  id: number;
  student_id: number;
  class_id: number;
  status: BookingStatus;
  seat_no: number | null;
  cancel_reason: string | null;
}

@Injectable()
export class BookingsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Creates a booking, or returns the existing active one for this
   * (student, class) pair — idempotent from the caller's point of view.
   * The partial unique index in the schema is the backstop for the
   * case where two identical requests race each other here.
   */
  async createBooking(studentId: number, classId: number): Promise<Booking> {
    const student = await this.pool.query('SELECT id FROM students WHERE id = $1', [studentId]);
    if (student.rowCount === 0) throw new NotFoundException('Student not found');

    const klass = await this.pool.query('SELECT id FROM trial_classes WHERE id = $1', [classId]);
    if (klass.rowCount === 0) throw new NotFoundException('Class not found');

    const existing = await this.pool.query<Booking>(
      `SELECT * FROM bookings
       WHERE student_id = $1 AND class_id = $2
         AND status IN ('pending_payment', 'confirmed')`,
      [studentId, classId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return existing.rows[0];
    }

    try {
      const inserted = await this.pool.query<Booking>(
        `INSERT INTO bookings (student_id, class_id, status)
         VALUES ($1, $2, 'pending_payment')
         RETURNING *`,
        [studentId, classId],
      );
      return inserted.rows[0];
    } catch (err: any) {
      // Unique violation = someone else's request won the race between
      // our SELECT above and this INSERT. Return their booking instead
      // of erroring, since the desired end state (one active booking
      // for this student+class) is already satisfied.
      if (err.code === '23505') {
        const raceWinner = await this.pool.query<Booking>(
          `SELECT * FROM bookings
           WHERE student_id = $1 AND class_id = $2
             AND status IN ('pending_payment', 'confirmed')`,
          [studentId, classId],
        );
        if (raceWinner.rowCount && raceWinner.rowCount > 0) return raceWinner.rows[0];
      }
      throw err;
    }
  }

  async getBooking(id: number): Promise<Booking> {
    const res = await this.pool.query<Booking>('SELECT * FROM bookings WHERE id = $1', [id]);
    if (res.rowCount === 0) throw new NotFoundException('Booking not found');
    return res.rows[0];
  }

  /**
   * Pay for a booking. This is the function the whole task is testing.
   *
   * Flow:
   *  1. Idempotency check — same key returns the same result, never
   *     double-charges or double-confirms.
   *  2. Call the (mock) payment gateway OUTSIDE any DB transaction, so
   *     we never hold a row lock while waiting on an external call.
   *  3. On gateway failure: mark payment_failed, no seat consumed.
   *  4. On gateway success: open a transaction, SELECT ... FOR UPDATE
   *     the class row (this is what serializes concurrent payers),
   *     recount confirmed bookings *inside* that lock, and only then
   *     decide confirmed vs cancelled(class_full).
   *
   * This is what makes the last-seat race safe: whoever's transaction
   * acquires the row lock first does its count-and-decide atomically;
   * the second payer's SELECT ... FOR UPDATE blocks until the first
   * transaction commits, so it recounts and correctly sees the seat
   * is gone.
   */
  async payBooking(
    bookingId: number,
    idempotencyKey: string,
    simulate: 'success' | 'fail',
  ): Promise<Booking> {
    const existingAttempt = await this.pool.query(
      'SELECT * FROM payment_attempts WHERE idempotency_key = $1',
      [idempotencyKey],
    );
    if (existingAttempt.rowCount && existingAttempt.rowCount > 0) {
      return this.getBooking(bookingId);
    }

    const booking = await this.getBooking(bookingId);
    if (booking.status === 'confirmed') {
      return booking; // already done — idempotent no-op
    }
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Booking was cancelled and cannot be paid');
    }

    const result = await chargeMock(simulate);

    if (!result.ok) {
      await this.pool.query(
        `INSERT INTO payment_attempts (booking_id, idempotency_key, status, failure_reason)
         VALUES ($1, $2, 'failed', $3)`,
        [bookingId, idempotencyKey, result.reason],
      );
      await this.pool.query(
        `UPDATE bookings SET status = 'payment_failed', updated_at = now() WHERE id = $1`,
        [bookingId],
      );
      return this.getBooking(bookingId);
    }

    // Gateway authorized the charge — now claim (or lose) the seat
    // atomically under a row lock on the class.
    return withTransaction(this.pool, async (client) => {
      const attempt = await client.query(
        `INSERT INTO payment_attempts (booking_id, idempotency_key, status)
         VALUES ($1, $2, 'authorized')
         RETURNING id`,
        [bookingId, idempotencyKey],
      );
      const attemptId = attempt.rows[0].id;

      const klass = await client.query(
        'SELECT id, capacity FROM trial_classes WHERE id = $1 FOR UPDATE',
        [booking.class_id],
      );
      const capacity = klass.rows[0].capacity as number;

      const countRes = await client.query(
        `SELECT COUNT(*)::int AS n FROM bookings
         WHERE class_id = $1 AND status = 'confirmed'`,
        [booking.class_id],
      );
      const confirmedCount = countRes.rows[0].n as number;

      if (confirmedCount >= capacity) {
        await client.query(
          `UPDATE bookings SET status = 'cancelled', cancel_reason = 'class_full', updated_at = now()
           WHERE id = $1`,
          [bookingId],
        );
        await client.query(`UPDATE payment_attempts SET status = 'voided' WHERE id = $1`, [attemptId]);
        return this.rowFrom(client, bookingId);
      }

      const seatNo = confirmedCount + 1;
      await client.query(
        `UPDATE bookings SET status = 'confirmed', seat_no = $2, updated_at = now() WHERE id = $1`,
        [bookingId, seatNo],
      );
      await client.query(`UPDATE payment_attempts SET status = 'captured' WHERE id = $1`, [attemptId]);
      return this.rowFrom(client, bookingId);
    });
  }

  private async rowFrom(client: { query: Pool['query'] }, bookingId: number): Promise<Booking> {
    const res = await client.query<Booking>('SELECT * FROM bookings WHERE id = $1', [bookingId]);
    return res.rows[0];
  }
}
