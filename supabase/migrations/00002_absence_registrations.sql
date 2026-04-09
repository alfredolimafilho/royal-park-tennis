-- Absence registrations: allows users with fixed reservations to register
-- periods of absence (travel, medical leave, etc.), freeing their slots
-- for one-time bookings during those periods.

CREATE TABLE absence_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fixed_reservation_id UUID NOT NULL REFERENCES fixed_reservations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT absence_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX idx_absences_dates ON absence_registrations(start_date, end_date);
CREATE INDEX idx_absences_fixed_res ON absence_registrations(fixed_reservation_id);
CREATE INDEX idx_absences_user ON absence_registrations(user_id);
