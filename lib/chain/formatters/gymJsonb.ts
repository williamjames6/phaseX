export function convertJSONBToString(jsonbData: unknown): string {
  if (!jsonbData || typeof jsonbData !== 'object') {
    return 'No gym session data available';
  }

  const parts: string[] = [];

  Object.entries(jsonbData as Record<string, unknown>).forEach(([supersetKey, supersetData]) => {
    const supersetNum = parseInt(supersetKey.replace('superset', ''), 10);
    if (!supersetData || typeof supersetData !== 'object') return;

    parts.push(`Superset ${supersetNum}:`);

    Object.entries(supersetData as Record<string, unknown>).forEach(([exerciseKey, exerciseData]) => {
      const exerciseNum = parseInt(exerciseKey.replace('exercise', ''), 10);
      const row = exerciseData as { exercise_name?: string; sets?: Record<string, unknown> };
      const exerciseName = row?.exercise_name || 'Unnamed Exercise';

      parts.push(`  Exercise ${exerciseNum}: ${exerciseName}`);

      if (row?.sets && typeof row.sets === 'object') {
        Object.entries(row.sets).forEach(([setKey, setData]) => {
          const setNum = parseInt(setKey.replace('set', ''), 10);
          const set = setData as { reps?: unknown; weight?: unknown; time?: unknown };
          const reps = set?.reps ?? 'N/A';
          const weight = set?.weight ?? 'N/A';
          const time = set?.time ?? 'N/A';
          parts.push(`    Set ${setNum}: ${reps} reps, ${weight} lbs, ${time} seconds`);
        });
      }
    });

    parts.push('');
  });

  return parts.join('\n');
}

/** Case-insensitive match on exercise_name anywhere in gym session JSONB. */
export function gymDataContainsExercise(jsonbData: unknown, needle: string): boolean {
  if (!jsonbData || typeof jsonbData !== 'object' || !needle.trim()) {
    return false;
  }
  const hay = needle.trim().toLowerCase();

  for (const supersetData of Object.values(jsonbData as Record<string, unknown>)) {
    if (!supersetData || typeof supersetData !== 'object') continue;
    for (const exerciseData of Object.values(supersetData as Record<string, unknown>)) {
      const row = exerciseData as { exercise_name?: string };
      const name = row?.exercise_name;
      if (typeof name === 'string' && name.toLowerCase().includes(hay)) {
        return true;
      }
    }
  }

  return false;
}
