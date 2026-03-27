-- Tighten and expand note access rules without changing table structure.

-- community_notes policies
DROP POLICY IF EXISTS "Allow INSERT on community_notes for authorized roles" ON public.community_notes;
DROP POLICY IF EXISTS "Allow SELECT on community_notes for admin and tiferet_david" ON public.community_notes;
DROP POLICY IF EXISTS "Admins can manage community notes" ON public.community_notes;
DROP POLICY IF EXISTS "Community managers can manage own community notes" ON public.community_notes;
DROP POLICY IF EXISTS "Admins and Tiferet David can read community notes" ON public.community_notes;
DROP POLICY IF EXISTS "Community managers can read own notes" ON public.community_notes;
DROP POLICY IF EXISTS "Community managers can insert notes for their community" ON public.community_notes;

CREATE POLICY "Admins and Tiferet David can read community notes"
ON public.community_notes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'tiferet_david'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'community_manager'::public.app_role)
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.records r
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE r.id = community_notes.record_id
        AND r.community_id = p.community_id
    )
  )
);

CREATE POLICY "Community managers can insert notes for their community"
ON public.community_notes
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'community_manager'::public.app_role)
      AND user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.records r
        JOIN public.profiles p ON p.user_id = auth.uid()
        WHERE r.id = community_notes.record_id
          AND r.community_id = p.community_id
      )
    )
  )
);

CREATE POLICY "Admins can manage community notes"
ON public.community_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Community managers can manage own community notes"
ON public.community_notes
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'community_manager'::public.app_role)
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.records r
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE r.id = community_notes.record_id
      AND r.community_id = p.community_id
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'community_manager'::public.app_role)
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.records r
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE r.id = community_notes.record_id
      AND r.community_id = p.community_id
  )
);

CREATE POLICY "Community managers can delete own community notes"
ON public.community_notes
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'community_manager'::public.app_role)
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.records r
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE r.id = community_notes.record_id
      AND r.community_id = p.community_id
  )
);

-- td_notes policies
DROP POLICY IF EXISTS "Allow ALL on td_notes for admin and tiferet_david" ON public.td_notes;
DROP POLICY IF EXISTS "Admins and Tiferet David can read td notes" ON public.td_notes;
DROP POLICY IF EXISTS "Admins and Tiferet David can insert td notes" ON public.td_notes;
DROP POLICY IF EXISTS "Admins can manage all td notes" ON public.td_notes;
DROP POLICY IF EXISTS "Tiferet David can manage own td notes" ON public.td_notes;

CREATE POLICY "Admins and Tiferet David can read td notes"
ON public.td_notes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'tiferet_david'::public.app_role)
);

CREATE POLICY "Admins and Tiferet David can insert td notes"
ON public.td_notes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tiferet_david'::public.app_role)
  )
);

CREATE POLICY "Admins can manage all td notes"
ON public.td_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Tiferet David can manage own td notes"
ON public.td_notes
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'tiferet_david'::public.app_role)
  AND user_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'tiferet_david'::public.app_role)
  AND user_id = auth.uid()
);

CREATE POLICY "Tiferet David can delete own td notes"
ON public.td_notes
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'tiferet_david'::public.app_role)
  AND user_id = auth.uid()
);

-- Realtime for records so active sessions can receive updates when needed.
ALTER PUBLICATION supabase_realtime ADD TABLE public.records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.td_notes;