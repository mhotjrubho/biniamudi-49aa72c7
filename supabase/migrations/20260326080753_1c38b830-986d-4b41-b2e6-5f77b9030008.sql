
-- Add action_type column to history_logs
ALTER TABLE public.history_logs ADD COLUMN IF NOT EXISTS action_type text DEFAULT 'risk_level_changed';

-- Add FK from history_logs.changed_by to profiles.user_id
ALTER TABLE public.history_logs ADD CONSTRAINT history_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(user_id);

-- Fix unresolved_records RLS: drop old broken policy, create correct one
DROP POLICY IF EXISTS "Enable all for admin" ON public.unresolved_records;
CREATE POLICY "Admins can manage unresolved records" ON public.unresolved_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
