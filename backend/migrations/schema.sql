-- Ottodot Trial Booking — schema
-- Design notes (see README for full rationale):
--   * bookings.status is the source of truth for seat usage.
--     Only 'confirmed' bookings count toward capacity — 'pending_payment'
--     never reserves a seat.
--   * The partial unique index below prevents duplicate ACTIVE bookings
--     for the same (student, class) at the database level, as a backstop
--     to the application-level check.
--   * payment_attempts is separate from bookings so a booking can be
--     retried after a failed payment without losing history.

CREATE TABLE parents (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id         SERIAL PRIMARY KEY,
  parent_id  INTEGER NOT NULL REFERENCES parents(id),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trial_classes (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  subject    TEXT,
  starts_at  TIMESTAMPTZ NOT NULL,
  capacity   INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id             SERIAL PRIMARY KEY,
  student_id     INTEGER NOT NULL REFERENCES students(id),
  class_id       INTEGER NOT NULL REFERENCES trial_classes(id),
  status         TEXT NOT NULL DEFAULT 'pending_payment'
                   CHECK (status IN ('pending_payment', 'confirmed', 'payment_failed', 'cancelled')),
  seat_no        INTEGER CHECK (seat_no BETWEEN 1 AND 4),
  cancel_reason  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevents duplicate ACTIVE bookings for the same child + class.
-- 'active' = still pending payment or already confirmed.
-- payment_failed / cancelled bookings are excluded, so a parent CAN
-- create a fresh booking after a failed attempt or a lost race.
CREATE UNIQUE INDEX uq_active_booking_per_student_class
  ON bookings (student_id, class_id)
  WHERE status IN ('pending_payment', 'confirmed');

-- Defense-in-depth against overbooking: at most one confirmed booking
-- per (class_id, seat_no). Combined with the FOR UPDATE lock in
-- BookingsService, this means even a bug in the app-level count would
-- still be caught by the database.
CREATE UNIQUE INDEX uq_confirmed_seat_per_class
  ON bookings (class_id, seat_no)
  WHERE status = 'confirmed';

CREATE INDEX idx_bookings_class_status ON bookings (class_id, status);
CREATE INDEX idx_bookings_student ON bookings (student_id);

CREATE TABLE payment_attempts (
  id               SERIAL PRIMARY KEY,
  booking_id       INTEGER NOT NULL REFERENCES bookings(id),
  idempotency_key  TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'authorized'
                     CHECK (status IN ('authorized', 'captured', 'failed', 'voided')),
  amount           NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
  failure_reason   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_attempts_booking ON payment_attempts (booking_id);
