-- Add td_notes column for Tiferet David notes (visible to admin + tiferet_david only)
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS td_notes text DEFAULT null;

-- Fix security: restrict history_logs INSERT to specific roles
DROP POLICY IF EXISTS "Authenticated can insert history" ON public.history_logs;
CREATE POLICY "Managers and admins can insert history"
ON public.history_logs
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = auth.uid() AND (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'community_manager'::app_role)
  )
);

-- Add WITH CHECK to admin ALL policy on user_roles for safety
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow Tiferet David to insert history logs too (for notes)
CREATE POLICY "Tiferet David can insert history"
ON public.history_logs
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = auth.uid() AND
  public.has_role(auth.uid(), 'tiferet_david'::app_role)
);