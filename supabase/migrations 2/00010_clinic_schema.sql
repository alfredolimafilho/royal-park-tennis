-- =============================================
-- ITA CLINIC - Schema Principal
-- =============================================

-- Limpar tabelas antigas se existirem
DROP TABLE IF EXISTS team_payment_items CASCADE;
DROP TABLE IF EXISTS surgery_payments CASCADE;
DROP TABLE IF EXISTS surgeries CASCADE;
DROP TABLE IF EXISTS quote_items CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS ita_protocols CASCADE;
DROP TABLE IF EXISTS procedures CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS store_items CASCADE;

-- =============================================
-- PACIENTES
-- =============================================
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  birth_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROCEDIMENTOS (Precificações)
-- =============================================
CREATE TABLE procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('surgery', 'physio', 'store', 'operational')),
  name TEXT NOT NULL,
  is_additional BOOLEAN DEFAULT FALSE,
  -- Honorários e custos
  surgeon_fee NUMERIC(12,2) DEFAULT 0,
  anesthesiologist_fee NUMERIC(12,2) DEFAULT 0,
  auxiliary_fee NUMERIC(12,2) DEFAULT 0,
  instrumentadora_fee NUMERIC(12,2) DEFAULT 0,
  operational_costs NUMERIC(12,2) DEFAULT 0,
  tech_rental NUMERIC(12,2) DEFAULT 0,
  -- Premissas
  tax_rate NUMERIC(5,2) DEFAULT 10.43,
  commission_rate NUMERIC(5,2) DEFAULT 2,
  card_rate NUMERIC(5,2) DEFAULT 10,
  overhead_rate NUMERIC(5,2) DEFAULT 10,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Função para calcular custo total
CREATE OR REPLACE FUNCTION procedure_total_cost(p procedures) RETURNS NUMERIC AS $$
  SELECT p.surgeon_fee + p.anesthesiologist_fee + p.auxiliary_fee + p.instrumentadora_fee + p.operational_costs + p.tech_rental;
$$ LANGUAGE SQL STABLE;

-- =============================================
-- PROTOCOLOS ITA (Fisioterapia)
-- =============================================
CREATE TABLE ita_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('mama', 'abdome_lipo', 'combinadas', 'avulsos')),
  sessions INTEGER,
  total_value NUMERIC(12,2) DEFAULT 0,
  fisio_value NUMERIC(12,2) DEFAULT 0,
  nutri_value NUMERIC(12,2) DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ORÇAMENTOS
-- =============================================
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Paciente
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  -- Dados do orçamento
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired', 'surgery_scheduled')),
  quote_date DATE DEFAULT CURRENT_DATE,
  surgery_date DATE,
  origin TEXT DEFAULT 'Indicação',
  notes TEXT,
  -- Valores
  total_value NUMERIC(12,2) DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Itens do orçamento
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('surgery', 'additional', 'protocol', 'custom')),
  procedure_id UUID REFERENCES procedures(id) ON DELETE SET NULL,
  protocol_id UUID REFERENCES ita_protocols(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  -- Valores editáveis (snapshot da precificação)
  surgeon_fee NUMERIC(12,2) DEFAULT 0,
  anesthesiologist_fee NUMERIC(12,2) DEFAULT 0,
  auxiliary_fee NUMERIC(12,2) DEFAULT 0,
  instrumentadora_fee NUMERIC(12,2) DEFAULT 0,
  operational_costs NUMERIC(12,2) DEFAULT 0,
  tech_rental NUMERIC(12,2) DEFAULT 0,
  -- Valor final cobrado ao paciente
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CIRURGIAS (criadas ao aprovar orçamento)
-- =============================================
CREATE TABLE surgeries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  surgery_date DATE NOT NULL,
  procedure_name TEXT NOT NULL,
  -- Financeiro paciente
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  -- Equipe (valores da precificação, editáveis)
  anesthesiologist_fee NUMERIC(12,2) DEFAULT 0,
  auxiliary_fee NUMERIC(12,2) DEFAULT 0,
  auxiliary2_fee NUMERIC(12,2) DEFAULT 0,
  instrumentadora_fee NUMERIC(12,2) DEFAULT 0,
  tech_rental NUMERIC(12,2) DEFAULT 0,
  fisio_fee NUMERIC(12,2) DEFAULT 0,
  nutri_fee NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagamentos de cirurgias (parcelas)
CREATE TABLE surgery_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id UUID NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'pix',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PAGAMENTOS DE EQUIPE
-- =============================================
CREATE TABLE team_payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id UUID NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('anesthesiologist', 'auxiliary', 'auxiliary2', 'instrumentadora', 'tech', 'fisio', 'nutri')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  authorized BOOLEAN DEFAULT FALSE,
  authorized_at TIMESTAMPTZ,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ITA STORE (Cintas e Kits)
-- =============================================
CREATE TABLE store_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('item', 'kit')),
  final_price NUMERIC(12,2) DEFAULT 0,
  cost_price NUMERIC(12,2) DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TRIGGER: atualiza total_paid nas cirurgias
-- =============================================
CREATE OR REPLACE FUNCTION update_surgery_total_paid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE surgeries
  SET 
    total_paid = (SELECT COALESCE(SUM(amount), 0) FROM surgery_payments WHERE surgery_id = COALESCE(NEW.surgery_id, OLD.surgery_id)),
    status = CASE 
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM surgery_payments WHERE surgery_id = COALESCE(NEW.surgery_id, OLD.surgery_id)) >= total_value THEN 'paid'
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.surgery_id, OLD.surgery_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER surgery_payments_changed
  AFTER INSERT OR UPDATE OR DELETE ON surgery_payments
  FOR EACH ROW EXECUTE FUNCTION update_surgery_total_paid();

-- =============================================
-- TRIGGER: atualiza total do orçamento
-- =============================================
CREATE OR REPLACE FUNCTION update_quote_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE quotes
  SET 
    total_value = (SELECT COALESCE(SUM(value), 0) FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_items_changed
  AFTER INSERT OR UPDATE OR DELETE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION update_quote_total();

-- =============================================
-- TRIGGER: quando orçamento é aprovado → cria cirurgia
-- =============================================
CREATE OR REPLACE FUNCTION create_surgery_from_quote()
RETURNS TRIGGER AS $$
DECLARE
  main_procedure_name TEXT;
  anest_fee NUMERIC := 0;
  aux_fee NUMERIC := 0;
  inst_fee NUMERIC := 0;
  tech_fee NUMERIC := 0;
BEGIN
  -- Só executa quando muda para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Pega nome do procedimento principal
    SELECT name INTO main_procedure_name
    FROM quote_items
    WHERE quote_id = NEW.id AND item_type = 'surgery'
    ORDER BY sort_order LIMIT 1;
    
    IF main_procedure_name IS NULL THEN
      main_procedure_name = 'Cirurgia';
    END IF;

    -- Agrega honorários da equipe dos itens
    SELECT 
      COALESCE(SUM(anesthesiologist_fee), 0),
      COALESCE(SUM(auxiliary_fee), 0),
      COALESCE(SUM(instrumentadora_fee), 0),
      COALESCE(SUM(tech_rental), 0)
    INTO anest_fee, aux_fee, inst_fee, tech_fee
    FROM quote_items WHERE quote_id = NEW.id;

    -- Cria a cirurgia
    INSERT INTO surgeries (
      quote_id, patient_id, patient_name, surgery_date, procedure_name,
      total_value, anesthesiologist_fee, auxiliary_fee, instrumentadora_fee, tech_rental
    ) VALUES (
      NEW.id, NEW.patient_id, NEW.patient_name,
      COALESCE(NEW.surgery_date, CURRENT_DATE + INTERVAL '30 days'),
      main_procedure_name, NEW.total_value,
      anest_fee, aux_fee, inst_fee, tech_fee
    );

    -- Atualiza status do orçamento
    NEW.status := 'surgery_scheduled';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_approved
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION create_surgery_from_quote();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE ita_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_payment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;

-- Admins e staff têm acesso total
CREATE POLICY "admin_full_access_patients" ON patients FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_full_access_procedures" ON procedures FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_full_access_protocols" ON ita_protocols FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_full_access_quotes" ON quotes FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_full_access_quote_items" ON quote_items FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_full_access_surgeries" ON surgeries FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_full_access_surgery_payments" ON surgery_payments FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_full_access_team_payments" ON team_payment_items FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_full_access_store" ON store_items FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- =============================================
-- SEED: Procedimentos da planilha
-- =============================================
INSERT INTO procedures (category, name, is_additional, surgeon_fee, anesthesiologist_fee, auxiliary_fee, instrumentadora_fee, operational_costs, tech_rental, sort_order) VALUES
-- Cirurgias Corporais
('surgery', 'Lipo com Tecnologias - 2 Áreas', false, 20000, 3500, 2000, 700, 1943, 5287, 1),
('surgery', 'Abdominoplastia + Lipo com Tecnologias - 2 Áreas', false, 30000, 6000, 2000, 700, 2930.45, 5287, 2),
('surgery', 'Adicional de Lipo com Tecnologias (p/ área)', true, 3500, 500, 0, 0, 0, 0, 3),
('surgery', 'Miniabdome ou Correção de Cicatriz', true, 3500, 1000, 0, 0, 458, 0, 4),
-- Cirurgias Mamárias
('surgery', 'Prótese de Mama - Qualquer técnica', false, 15000, 2100, 0, 300, 2282.15, 0, 10),
('surgery', 'Mamoplastias (Mastopexia, Redutora ou Explante)', false, 20000, 3000, 1800, 500, 2554.45, 0, 11),
('surgery', 'Troca de Prótese', false, 25000, 3000, 1800, 500, 1625, 0, 12),
-- Cirurgias Combinadas
('surgery', 'Protese + Abdominoplastia + Lipo 2 Áreas', false, 28000, 5600, 2000, 800, 2600.15, 5287, 20),
('surgery', 'Protese + Abdominoplastia + Lipo 2 Áreas com Tecnologias', false, 36000, 8100, 2000, 800, 3587.60, 5287, 21),
('surgery', 'Mamoplastia + Lipo 2 Áreas com Tecnologias', false, 32000, 6500, 1000, 800, 2872.45, 5287, 22),
('surgery', 'Mamoplastia + Abdominoplastia + Lipo 2 Áreas', false, 40000, 9000, 4000, 1000, 3859.90, 5287, 23),
('surgery', 'Troca de Prótese + Abdominoplastia + Lipo 2 Áreas', false, 44000, 9000, 4000, 1000, 2930.45, 5287, 24),
-- Outros
('surgery', 'Otoplastia', false, 5000, 2100, 1800, 250, 1625, 0, 30),
('surgery', 'Ninfoplastia', false, 5000, 2100, 1800, 250, 1625, 0, 31),
('surgery', 'Remodelação Glútea', false, 10000, 0, 0, 0, 2359.98, 0, 32);

-- Protocolos ITA
INSERT INTO ita_protocols (name, category, sessions, total_value, fisio_value, nutri_value, sort_order) VALUES
('Mama 5 Sessões com TAPPING', 'mama', 5, 2291, 1350, 450, 1),
('Mama 10 Sessões com TAPPING', 'mama', 10, 3054, 1950, 450, 2),
('Abdome/Lipo 5 Sessões com TAPPING', 'abdome_lipo', 5, 3080, 1970, 450, 3),
('Abdome/Lipo 10 Sessões com TAPPING', 'abdome_lipo', 10, 3996, 2690, 450, 4),
('Combinadas 5 Sessões com TAPPING', 'combinadas', 5, 3232, 2090, 450, 5),
('Combinadas 10 Sessões com TAPPING', 'combinadas', 10, 4301, 2930, 450, 6),
('Avulsos Tapping + Nutri', 'avulsos', null, 1527, 750, 450, 7),
('Avulsos Tapping Lipo + Nutri', 'avulsos', null, 2163, 1250, 450, 8),
('Avulsos Sessão Avulsa Drenagem COMBINADA', 'avulsos', 1, 214, 168, 0, 9),
('Avulsos Sessão Avulsa Drenagem MAMA', 'avulsos', 1, 153, 120, 0, 10),
('Avulsos Sessão Avulsa Drenagem ABDOME', 'avulsos', 1, 183, 144, 0, 11);

-- ITA Store
INSERT INTO store_items (brand, name, category, final_price, cost_price, sort_order) VALUES
('Newforms', 'Meias', 'item', 155, 63, 1),
('Cores', 'Sutiã', 'item', 170, 91, 2),
('Cores', 'Cinta simples', 'item', 386, 193, 3),
('R Slim', 'Cinta 2a Etapa', 'item', 810, 594.41, 4),
('R Slim', 'Kit Talas Completo', 'item', 680, 465.75, 5),
('Cores', 'Colete de Corpo', 'item', 340, 105.75, 6),
('R Slim', 'Tala Axilar', 'item', 250, 100.01, 7),
('Newform', 'Modelador Braço', 'item', 170, 64.97, 8),
('R Slim', 'Tala Braço', 'item', 250, 109.46, 9),
('R Slim', 'Tala Abdominal', 'item', 250, 163.01, 10),
('R Slim', 'Talas Cinturas', 'item', 250, 163.01, 11),
('R Slim', 'Tala Dorsal', 'item', 250, 163.01, 12),
('R Slim', 'Syma', 'item', 350, 196.09, 13),
('R Slim', 'Colete de Corpo', 'item', 550, 361.46, 14),
('Cores', 'Faixa Otoplastia', 'item', 89, 45, 15),
('Cores', 'Faixa Mamoplastia', 'item', 129, 69, 16),
('Cores', 'Órtese Umbilical', 'item', 100, 42.53, 17),
-- Kits
('', 'Cirurgias Mamárias (1 sutiã)', 'kit', 170, 91, 20),
('', 'Cirurgia Mamária + Lipo Tórax Lateral (+ tala)', 'kit', 420, 191.01, 21),
('', 'Abdome/Lipo (Cinta 1a e 2a etapa + Meia)', 'kit', 1351, 850.41, 22),
('', 'Kit de Talas (1 Dorso, 1 Frente, 2 Flancos)', 'kit', 680, 465.75, 23),
('', 'Lipo de Braço (Modelador + Tala)', 'kit', 420, 174.43, 24);

