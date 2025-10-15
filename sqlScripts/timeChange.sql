ALTER TABLE actions ADD COLUMN time_stamp_seconds INT;

UPDATE actions
SET time_stamp_seconds =
    (
        (regexp_replace(time_stamp, '^(\d+):\d+$', '\1'))::int * 60 +
        (regexp_replace(time_stamp, '^\d+:(\d+)$', '\1'))::int
    );