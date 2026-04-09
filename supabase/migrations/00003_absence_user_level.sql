-- Make absence registrations user-level instead of per-fixed-reservation.
-- A single absence record now frees ALL fixed reservations of that user.
ALTER TABLE absence_registrations ALTER COLUMN fixed_reservation_id DROP NOT NULL;
DROP INDEX IF EXISTS idx_absences_fixed_res;
