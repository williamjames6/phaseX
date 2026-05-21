import { MAX_ROWS_PER_TOOL } from '../constants';
import { applyTemporal, parseTemporalInput, temporalInputSchema } from '../temporal';
import type { ToolContext } from '../types';
import { z } from 'zod';

const inputSchema = z.object({
  temporal: temporalInputSchema,
});

export async function queryTrainingLoad(
  args: z.infer<typeof inputSchema>,
  ctx: ToolContext
): Promise<{ rows: Record<string, unknown>[] }> {
  const spec = parseTemporalInput(args.temporal);
  let query = ctx.supabase
    .from('TrainingLoad')
    .select('date, trimp, aerobic_training_effect, anaerobic_training_effect, date_received');

  query = applyTemporal(query, spec, 'date');
  query = query.order('date_received', { ascending: false });

  const { data, error } = await query.limit(MAX_ROWS_PER_TOOL);

  if (error) {
    console.error('query_training_load:', error);
    return { rows: [] };
  }

  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const row of data ?? []) {
    const d = row.date as string | null;
    if (!d || seen.has(d)) continue;
    seen.add(d);
    rows.push(row);
  }

  return { rows };
}
