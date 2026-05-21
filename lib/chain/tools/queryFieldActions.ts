import { timeSwitch } from '../../../assets/helpers/timeSwitch';
import { MAX_ROWS_PER_TOOL } from '../constants';
import {
  applyTemporal,
  filterRowsByTemporal,
  parseTemporalInput,
  temporalInputSchema,
} from '../temporal';
import type { ToolContext } from '../types';
import { z } from 'zod';
import { searchSimilarActions } from './searchSimilarActions';

const inputSchema = z.object({
  temporal: temporalInputSchema,
  semantic_query: z.string().min(1).max(2000).nullable(),
  description_contains: z.string().min(1).max(200).nullable(),
  player_contains: z.string().min(1).max(200).nullable(),
});

export async function queryFieldActions(
  args: z.infer<typeof inputSchema>,
  ctx: ToolContext
): Promise<{
  actions: {
    session_date: string | null;
    time: string;
    description: string | null;
    player_mentions?: string | null;
    similarity?: number;
  }[];
}> {
  const spec = parseTemporalInput(args.temporal);

  if (args.semantic_query?.trim()) {
    const { actions } = await searchSimilarActions({ query: args.semantic_query.trim() }, ctx);
    const withDates = actions.map((a) => ({
      session_date: a.session_date,
      time: a.time,
      description: a.description,
      similarity: a.similarity,
    }));

    if (spec.mode === 'latest') {
      const sorted = [...withDates].sort((a, b) =>
        (b.session_date ?? '').localeCompare(a.session_date ?? '')
      );
      return { actions: sorted.slice(0, spec.count) };
    }

    const filtered = filterRowsByTemporal(
      withDates as { session_date: string | null }[],
      spec,
      'session_date'
    );
    return { actions: filtered as typeof withDates };
  }

  let query = ctx.supabase
    .from('FieldActions')
    .select('description, session_date, time_stamp_seconds, player_mentions');

  query = applyTemporal(query, spec, 'session_date');

  if (args.description_contains?.trim()) {
    const pattern = `%${args.description_contains.trim().replace(/%/g, '\\%')}%`;
    query = query.ilike('description', pattern);
  }

  if (args.player_contains?.trim()) {
    const pattern = `%${args.player_contains.trim().replace(/%/g, '\\%')}%`;
    query = query.ilike('player_mentions', pattern);
  }

  const { data, error } = await query.limit(MAX_ROWS_PER_TOOL);

  if (error) {
    console.error('query_field_actions:', error);
    return { actions: [] };
  }

  const actions = (data ?? []).map((row) => ({
    session_date: row.session_date as string | null,
    time: timeSwitch(row.time_stamp_seconds) as string,
    description: row.description as string | null,
    player_mentions: (row.player_mentions as string | null) ?? null,
  }));

  return { actions };
}
