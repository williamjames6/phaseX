import { MAX_ROWS_PER_TOOL } from '../constants';
import { applyTemporal, parseTemporalInput, temporalInputSchema } from '../temporal';
import type { ToolContext } from '../types';
import { z } from 'zod';

const inputSchema = z.object({
  temporal: temporalInputSchema,
  session_type: z.string().min(1).max(100).nullable(),
});

export async function queryFieldSessions(
  args: z.infer<typeof inputSchema>,
  ctx: ToolContext
): Promise<{ sessions: Record<string, unknown>[] }> {
  const spec = parseTemporalInput(args.temporal);
  let query = ctx.supabase
    .from('FieldSessions')
    .select('date, type, description, physical_score, mental_score, overall_score, note');

  query = applyTemporal(query, spec, 'date');

  if (args.session_type?.trim()) {
    const pattern = `%${args.session_type.trim().replace(/%/g, '\\%')}%`;
    query = query.ilike('type', pattern);
  }

  const { data, error } = await query.limit(MAX_ROWS_PER_TOOL);

  if (error) {
    console.error('query_field_sessions:', error);
    return { sessions: [] };
  }

  return { sessions: data ?? [] };
}
