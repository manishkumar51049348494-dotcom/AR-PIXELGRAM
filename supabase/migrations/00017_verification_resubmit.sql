-- Rejected verification request ke baad user dobara request kar sake.
-- Pehle sirf INSERT allowed tha aur user_id par UNIQUE hone ki wajah se
-- rejected row ko replace karna possible nahi tha.

GRANT SELECT, INSERT, UPDATE ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;

DROP POLICY IF EXISTS "verif_update_own_rejected" ON public.verification_requests;
CREATE POLICY "verif_update_own_rejected" ON public.verification_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'rejected')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
