import { convertJSONBToString, gymDataContainsExercise } from '../formatters/gymJsonb';
import { GYM_EXERCISE_SCAN_CAP, MAX_ROWS_PER_TOOL } from '../constants';
import {
  applyTemporal,
  parseTemporalInput,
  temporalInputSchema,
  type TemporalSpec,
} from '../temporal';
import type { ToolContext } from '../types';
import { z } from 'zod';

const inputSchema = z.object({
  temporal: temporalInputSchema,
  exercise_name_contains: z.string().min(1).max(200).nullable(),
});

type GymSessionRow = {
  session_date: string;
  note: string | null;
  data_text: string;
};

function mapGymRow(row: { session_date: unknown; data: unknown; note: unknown }): GymSessionRow {
  return {
    session_date: row.session_date as string,
    note: (row.note as string | null) ?? null,
    data_text:
      row.data && typeof row.data === 'object'
        ? convertJSONBToString(row.data)
        : 'No gym session data available',
  };
}

async function fetchGymRows(
  ctx: ToolContext,
  spec: TemporalSpec,
  fetchLimit: number
): Promise<{ session_date: string; data: unknown; note: unknown }[]> {
  let query = ctx.supabase.from('GymSessions').select('session_date, data, note');

  if (spec.mode === 'latest' && fetchLimit > spec.count) {
    query = query.order('session_date', { ascending: false }).limit(fetchLimit);
  } else {
    query = applyTemporal(query, spec, 'session_date').limit(
      Math.min(fetchLimit, MAX_ROWS_PER_TOOL)
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('query_gym_sessions:', error);
    return [];
  }
  return (data ?? []) as { session_date: string; data: unknown; note: unknown }[];
}

export async function queryGymSessions(
  args: z.infer<typeof inputSchema>,
  ctx: ToolContext
): Promise<{ sessions: GymSessionRow[]; scanned_sessions?: number }> {
  const spec = parseTemporalInput(args.temporal);
  const exerciseFilter = args.exercise_name_contains?.trim() || null;

  if (exerciseFilter) {
    const rows = await fetchGymRows(ctx, { mode: 'latest', count: GYM_EXERCISE_SCAN_CAP }, GYM_EXERCISE_SCAN_CAP);
    const matched: GymSessionRow[] = [];
    for (const row of rows) {
      if (gymDataContainsExercise(row.data, exerciseFilter)) {
        matched.push(mapGymRow(row));
        if (spec.mode === 'latest' && matched.length >= spec.count) {
          break;
        }
      }
    }

    if (spec.mode !== 'latest') {
      const filtered = matched.filter((s) => {
        const d = s.session_date;
        if (spec.mode === 'explicit_dates') return spec.dates.includes(d);
        if (spec.mode === 'range') return d >= spec.start && d <= spec.end;
        if (spec.mode === 'on_or_before') return d <= spec.bound;
        if (spec.mode === 'on_or_after') return d >= spec.bound;
        return true;
      });
      return { sessions: filtered, scanned_sessions: rows.length };
    }

    return { sessions: matched, scanned_sessions: rows.length };
  }

  const limit =
    spec.mode === 'latest' ? spec.count : MAX_ROWS_PER_TOOL;
  const rows = await fetchGymRows(ctx, spec, limit);
  return { sessions: rows.map(mapGymRow) };
}
