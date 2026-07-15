-- Base schema for the Royal Park tennis court booking app.
--
-- This file documents (and can recreate) the core tables the app relies on.
-- It uses IF NOT EXISTS so it is safe to run against an existing production
-- database without dropping data. Run the whole migrations folder in order to
-- guarantee every table the app queries actually exists — a missing table
-- makes the corresponding query fail and the calendar shows up empty.

-- Residents / users. Login is by phone only (see auth-context.tsx).
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  house TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One-off (avulsa) reservations.
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  house TEXT NOT NULL,
  phone TEXT,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly recurring (fixa) reservations, subject to admin approval.
CREATE TABLE IF NOT EXISTS fixed_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  house TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_reservations_status ON fixed_reservations(status);
CREATE INDEX IF NOT EXISTS idx_fixed_reservations_user ON fixed_reservations(user_id);
