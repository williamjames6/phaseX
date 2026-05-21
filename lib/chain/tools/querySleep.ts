import { MAX_ROWS_PER_TOOL } from '../constants';
import { applyTemporal, parseTemporalInput, temporalInputSchema } from '../temporal';
import type { ToolContext } from '../types';
import { z } from 'zod';

const inputSchema = z.object({
  temporal: temporalInputSchema,
});

export async function querySleep(
  args: z.infer<typeof inputSchema>,
  ctx: ToolContext
): Promise<{ rows: Record<string, unknown>[] }> {
  const spec = parseTemporalInput(args.temporal);
  let query = ctx.supabase
    .from('Sleep')
    .select(
      'date, sleep_start, sleep_end, time_to_sleep, disruptions, subjective_quality, arousal, note'
    );

  query = applyTemporal(query, spec, 'date');

  const { data, error } = await query.limit(MAX_ROWS_PER_TOOL);

  if (error) {
    console.error('query_sleep:', error);
    return { rows: [] };
  }

  return { rows: data ?? [] };
}
