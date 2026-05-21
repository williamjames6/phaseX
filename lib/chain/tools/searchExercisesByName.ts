import { MAX_ROWS_PER_TOOL } from '../constants';
import type { ToolContext } from '../types';

export async function searchExercisesByName(
  args: { query: string; limit?: number },
  ctx: ToolContext
): Promise<{ exercises: { id: string; exercise: string | null }[] }> {
  const limit = Math.min(args.limit ?? 20, MAX_ROWS_PER_TOOL);
  const pattern = `%${args.query.replace(/%/g, '\\%')}%`;

  const { data, error } = await ctx.supabase
    .from('GymExercises')
    .select('id, exercise')
    .ilike('exercise', pattern)
    .limit(limit);

  if (error) {
    console.error('search_exercises_by_name:', error);
    return { exercises: [] };
  }

  return {
    exercises: (data ?? []).map((row) => ({
      id: row.id as string,
      exercise: row.exercise as string | null,
    })),
  };
}
