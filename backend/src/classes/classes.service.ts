import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.module';

@Injectable()
export class ClassesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Single query with a LEFT JOIN + GROUP BY, so listing classes never
  // does one seats-left query per row (N+1).
  async listWithSeatsLeft() {
    const res = await this.pool.query(`
      SELECT
        c.id, c.title, c.subject, c.starts_at, c.capacity,
        c.capacity - COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS seats_left
      FROM trial_classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      GROUP BY c.id
      ORDER BY c.starts_at
    `);
    return res.rows;
  }

  async roster(classId: number) {
    const res = await this.pool.query(
      `SELECT s.id AS student_id, s.name, b.seat_no
       FROM bookings b
       JOIN students s ON s.id = b.student_id
       WHERE b.class_id = $1 AND b.status = 'confirmed'
       ORDER BY b.seat_no`,
      [classId],
    );
    return res.rows;
  }
}
