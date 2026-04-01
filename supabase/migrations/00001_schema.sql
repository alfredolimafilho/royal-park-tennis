-- =============================================
-- ROYAL PARK - Quadra de Tênis - Schema
-- =============================================

-- USUÁRIOS (moradores)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  house TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(house, phone)
);

-- RESERVAS FIXAS (semanais recorrentes, precisam de aprovação admin)
CREATE TABLE fixed_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  house TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 1=Segunda...
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RESERVAS AVULSAS (dia específico)
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  house TEXT NOT NULL,
  phone TEXT,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_house ON reservations(house);
CREATE INDEX idx_fixed_reservations_day ON fixed_reservations(day_of_week);
CREATE INDEX idx_fixed_reservations_status ON fixed_reservations(status);

-- =============================================
-- SEED: Reservas Fixas da planilha atual
-- =============================================

-- Primeiro criar os moradores que têm reserva fixa
INSERT INTO users (name, house, phone, is_admin) VALUES
  ('Admin Royal Park', 'Admin', '00000000000', TRUE),
  ('Morador Casa 3', 'Casa 3', '00000000003', FALSE),
  ('Morador Casa 7', 'Casa 7', '00000000007', FALSE),
  ('Morador Casa 18', 'Casa 18', '00000000018', FALSE),
  ('Morador Casa 19', 'Casa 19', '00000000019', FALSE),
  ('Morador Casa 24', 'Casa 24', '00000000024', FALSE),
  ('Morador Casa 30', 'Casa 30', '00000000030', FALSE),
  ('Morador Casa 32', 'Casa 32', '00000000032', FALSE),
  ('Morador Casa 39', 'Casa 39', '00000000039', FALSE),
  ('Morador Casa 43', 'Casa 43', '00000000043', FALSE);

-- Reservas fixas (todas aprovadas - já existentes na planilha)
-- day_of_week: 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb, 0=Dom

-- SEGUNDA-FEIRA
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 32', 1, '17:30', '18:30', 'approved' FROM users WHERE house = 'Casa 32';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 7', 1, '18:30', '19:30', 'approved' FROM users WHERE house = 'Casa 7';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 43', 1, '19:30', '20:30', 'approved' FROM users WHERE house = 'Casa 43';

-- TERÇA-FEIRA
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 18', 2, '17:00', '18:00', 'approved' FROM users WHERE house = 'Casa 18';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 39', 2, '18:00', '19:00', 'approved' FROM users WHERE house = 'Casa 39';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 30', 2, '19:00', '20:00', 'approved' FROM users WHERE house = 'Casa 30';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 3', 2, '20:00', '21:00', 'approved' FROM users WHERE house = 'Casa 3';

-- QUARTA-FEIRA
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 32', 3, '17:00', '18:00', 'approved' FROM users WHERE house = 'Casa 32';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 43', 3, '18:00', '19:00', 'approved' FROM users WHERE house = 'Casa 43';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 18', 3, '19:00', '20:00', 'approved' FROM users WHERE house = 'Casa 18';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 19', 3, '20:00', '21:00', 'approved' FROM users WHERE house = 'Casa 19';

-- QUINTA-FEIRA
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 18', 4, '17:00', '18:00', 'approved' FROM users WHERE house = 'Casa 18';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 3', 4, '18:00', '19:00', 'approved' FROM users WHERE house = 'Casa 3';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 30', 4, '19:00', '20:00', 'approved' FROM users WHERE house = 'Casa 30';
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 24', 4, '21:00', '22:00', 'approved' FROM users WHERE house = 'Casa 24';

-- SEXTA-FEIRA
INSERT INTO fixed_reservations (user_id, house, day_of_week, start_time, end_time, status)
SELECT id, 'Casa 7', 5, '18:00', '19:00', 'approved' FROM users WHERE house = 'Casa 7';
