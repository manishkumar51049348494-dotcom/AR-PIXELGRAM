
-- Add missing columns to reports table
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS reported_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS admin_action text,
  ADD COLUMN IF NOT EXISTS admin_note text;

-- Drop old target_id-based index if any, add new index
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- Ensure problem_reports has proper user_id FK linkage (already exists but ensure index)
CREATE INDEX IF NOT EXISTS idx_problem_reports_user_id ON problem_reports(user_id);

-- Ensure appeals index
CREATE INDEX IF NOT EXISTS idx_appeals_user_id ON appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);

-- Ensure verification_requests index
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);

-- Enable RLS on all moderation tables if not already
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

-- Reports RLS: anyone can insert a report; admins can read/update all
DROP POLICY IF EXISTS "reports_insert" ON reports;
DROP POLICY IF EXISTS "reports_select_admin" ON reports;
DROP POLICY IF EXISTS "reports_update_admin" ON reports;
DROP POLICY IF EXISTS "reports_select_own" ON reports;

CREATE POLICY "reports_insert" ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reports_select_admin" ON reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "reports_select_own" ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "reports_update_admin" ON reports FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

-- Problem reports RLS
DROP POLICY IF EXISTS "problem_reports_insert" ON problem_reports;
DROP POLICY IF EXISTS "problem_reports_select_admin" ON problem_reports;

CREATE POLICY "problem_reports_insert" ON problem_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "problem_reports_select_admin" ON problem_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
    OR auth.uid() = user_id
  );

-- Appeals RLS
DROP POLICY IF EXISTS "appeals_insert" ON appeals;
DROP POLICY IF EXISTS "appeals_select" ON appeals;
DROP POLICY IF EXISTS "appeals_update_admin" ON appeals;

CREATE POLICY "appeals_insert" ON appeals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "appeals_select" ON appeals FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "appeals_update_admin" ON appeals FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

-- Verification requests RLS
DROP POLICY IF EXISTS "verif_insert" ON verification_requests;
DROP POLICY IF EXISTS "verif_select" ON verification_requests;
DROP POLICY IF EXISTS "verif_update_admin" ON verification_requests;

CREATE POLICY "verif_insert" ON verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verif_select" ON verification_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "verif_update_admin" ON verification_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );
