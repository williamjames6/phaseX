-- TrainingLoad incremental ingestion + per-user access model

ALTER TABLE public."TrainingLoad"
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS date date,
  ADD COLUMN IF NOT EXISTS date_received timestamptz,
  ADD COLUMN IF NOT EXISTS trimp numeric,
  ADD COLUMN IF NOT EXISTS aerobic_training_effect numeric,
  ADD COLUMN IF NOT EXISTS anaerobic_training_effect numeric;

CREATE INDEX IF NOT EXISTS trainingload_user_date_received_idx
  ON public."TrainingLoad" (user_id, date_received DESC);

ALTER TABLE public."TrainingLoad" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TrainingLoad select own" ON public."TrainingLoad";
CREATE POLICY "TrainingLoad select own"
ON public."TrainingLoad"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "TrainingLoad insert own" ON public."TrainingLoad";
CREATE POLICY "TrainingLoad insert own"
ON public."TrainingLoad"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "TrainingLoad update own" ON public."TrainingLoad";
CREATE POLICY "TrainingLoad update own"
ON public."TrainingLoad"
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "TrainingLoad delete own" ON public."TrainingLoad";
CREATE POLICY "TrainingLoad delete own"
ON public."TrainingLoad"
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
