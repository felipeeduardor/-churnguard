-- =============================================
-- ChurnGuard SaaS - Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Empresas (multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Profiles (ligado ao Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  name text,
  role text DEFAULT 'member'
);

-- Uploads de CSV
CREATE TABLE IF NOT EXISTS uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  filename text,
  status text DEFAULT 'processing',
  total_clientes int,
  created_at timestamptz DEFAULT now()
);

-- Resultados de predição por cliente
CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES uploads(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  codcli int NOT NULL,
  probabilidade_churn float NOT NULL,
  segmento text,
  vl_nota_sum float,
  frequencia_compras int,
  ticket_medio float,
  recencia_dias float,
  regiao text,
  shap_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- Planos de ação para clientes em risco
CREATE TABLE IF NOT EXISTS action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid REFERENCES predictions(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  status text DEFAULT 'pendente',
  responsavel text,
  prazo date,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's org_id
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$;

-- Organizations: users can only see their own org
CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (id = get_my_org_id());

CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK (true);

-- Profiles: users can see profiles in their org
CREATE POLICY "profile_select" ON profiles
  FOR SELECT USING (org_id = get_my_org_id() OR id = auth.uid());

CREATE POLICY "profile_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profile_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Uploads: org-scoped
CREATE POLICY "uploads_all" ON uploads
  FOR ALL USING (org_id = get_my_org_id());

-- Predictions: org-scoped
CREATE POLICY "predictions_all" ON predictions
  FOR ALL USING (org_id = get_my_org_id());

-- Action plans: org-scoped
CREATE POLICY "action_plans_all" ON action_plans
  FOR ALL USING (org_id = get_my_org_id());

-- =============================================
-- Registration function (bypasses RLS safely)
-- =============================================

CREATE OR REPLACE FUNCTION register_organization(org_name text, user_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO organizations (name) VALUES (org_name) RETURNING id INTO new_org_id;
  INSERT INTO profiles (id, org_id, name, role) VALUES (auth.uid(), new_org_id, user_name, 'admin');
  RETURN new_org_id;
END;
$$;

-- =============================================
-- Indexes for performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_predictions_org_id ON predictions(org_id);
CREATE INDEX IF NOT EXISTS idx_predictions_upload_id ON predictions(upload_id);
CREATE INDEX IF NOT EXISTS idx_predictions_codcli ON predictions(codcli);
CREATE INDEX IF NOT EXISTS idx_predictions_segmento ON predictions(segmento);
CREATE INDEX IF NOT EXISTS idx_uploads_org_id ON uploads(org_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_prediction_id ON action_plans(prediction_id);
