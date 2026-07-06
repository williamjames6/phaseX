-- Create Notes table and migrate note/global sessions out of FieldSessions/FieldActions.

CREATE TABLE public."Notes" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date,
  type text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  description text,
  note text NOT NULL DEFAULT ''
);

CREATE INDEX notes_user_id_date_idx ON public."Notes" (user_id, date);
CREATE INDEX notes_user_id_type_description_idx ON public."Notes" (user_id, type, description);

ALTER TABLE public."Notes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notes select own" ON public."Notes";
CREATE POLICY "Notes select own"
ON public."Notes"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Notes insert own" ON public."Notes";
CREATE POLICY "Notes insert own"
ON public."Notes"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Notes update own" ON public."Notes";
CREATE POLICY "Notes update own"
ON public."Notes"
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Notes delete own" ON public."Notes";
CREATE POLICY "Notes delete own"
ON public."Notes"
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Migrate rows that have at least one FieldAction (skip empty sessions).
INSERT INTO public."Notes" (id, date, type, user_id, description, note)
SELECT
  gen_random_uuid(),
  fs.date,
  CASE
    WHEN fs.type = 'global' THEN 'global'
    WHEN fs.date IS NULL AND fs.description IN ('MASTER', 'SKILL') THEN 'global'
    ELSE fs.type
  END,
  fs.user_id,
  fs.description,
  COALESCE(fa.description, '')
FROM public."FieldSessions" fs
INNER JOIN public."FieldActions" fa ON fa.session_id = fs.id
WHERE fs.type IN ('note', 'global');

-- Remove sketches tied to migrated note actions.
DELETE FROM public."TacticalSketches" ts
USING public."FieldActions" fa
INNER JOIN public."FieldSessions" fs ON fs.id = fa.session_id
WHERE ts.id = fa.sketch_id
  AND fs.type IN ('note', 'global');

DELETE FROM public."FieldActions" fa
USING public."FieldSessions" fs
WHERE fa.session_id = fs.id
  AND fs.type IN ('note', 'global');

DELETE FROM public."FieldSessions"
WHERE type IN ('note', 'global');
