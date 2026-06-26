-- Existing rows were backfilled when created_at was added; clear them so only new rows get now().

UPDATE public."GymSessions"
SET created_at = NULL
WHERE created_at IS NOT NULL;

UPDATE public."FieldSessions"
SET created_at = NULL
WHERE created_at IS NOT NULL;
