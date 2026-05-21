import { z } from 'zod';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { MAX_ROWS_PER_TOOL } from './constants';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const datesArraySchema = z.array(isoDate).min(1).max(31);

export type DateColumn = 'session_date' | 'date';

export type TemporalSpec =
  | { mode: 'explicit_dates'; dates: string[] }
  | { mode: 'latest'; count: number }
  | { mode: 'range'; start: string; end: string }
  | { mode: 'on_or_before'; bound: string; limit?: number }
  | { mode: 'on_or_after'; bound: string; limit?: number };

/** Flat input from the model (strict JSON schema); validated into TemporalSpec. */
export const temporalInputSchema = z
  .object({
    mode: z.enum(['explicit_dates', 'latest', 'range', 'on_or_before', 'on_or_after']),
    dates: z.array(isoDate).nullable(),
    count: z.number().int().min(1).max(50).nullable(),
    start: isoDate.nullable(),
    end: isoDate.nullable(),
    bound: isoDate.nullable(),
    limit: z.number().int().min(1).max(50).nullable(),
  })
  .superRefine((val, ctx) => {
    switch (val.mode) {
      case 'explicit_dates':
        if (!val.dates?.length) {
          ctx.addIssue({ code: 'custom', message: 'dates required for explicit_dates', path: ['dates'] });
        }
        break;
      case 'latest':
        if (val.count == null) {
          ctx.addIssue({ code: 'custom', message: 'count required for latest', path: ['count'] });
        }
        break;
      case 'range':
        if (!val.start || !val.end) {
          ctx.addIssue({ code: 'custom', message: 'start and end required for range', path: ['start'] });
        }
        break;
      case 'on_or_before':
      case 'on_or_after':
        if (!val.bound) {
          ctx.addIssue({ code: 'custom', message: 'bound required', path: ['bound'] });
        }
        break;
      default:
        break;
    }
  });

export function parseTemporalInput(
  input: z.infer<typeof temporalInputSchema>
): TemporalSpec {
  switch (input.mode) {
    case 'explicit_dates':
      return { mode: 'explicit_dates', dates: input.dates! };
    case 'latest':
      return { mode: 'latest', count: input.count! };
    case 'range':
      return { mode: 'range', start: input.start!, end: input.end! };
    case 'on_or_before':
      return {
        mode: 'on_or_before',
        bound: input.bound!,
        limit: input.limit ?? undefined,
      };
    case 'on_or_after':
      return {
        mode: 'on_or_after',
        bound: input.bound!,
        limit: input.limit ?? undefined,
      };
    default:
      return { mode: 'latest', count: 1 };
  }
}

export const TEMPORAL_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    mode: {
      type: 'string',
      enum: ['explicit_dates', 'latest', 'range', 'on_or_before', 'on_or_after'],
      description:
        'How to select rows by date: explicit_dates (list), latest (most recent N), range (inclusive), on_or_before, on_or_after',
    },
    dates: {
      type: ['array', 'null'],
      items: { type: 'string', description: 'YYYY-MM-DD' },
      description: 'Required when mode is explicit_dates; otherwise null',
    },
    count: {
      type: ['integer', 'null'],
      description: 'Required when mode is latest (e.g. 1 for "last lift"); otherwise null',
    },
    start: { type: ['string', 'null'], description: 'Range start YYYY-MM-DD; null otherwise' },
    end: { type: ['string', 'null'], description: 'Range end YYYY-MM-DD; null otherwise' },
    bound: {
      type: ['string', 'null'],
      description: 'Single date bound for on_or_before / on_or_after; null otherwise',
    },
    limit: {
      type: ['integer', 'null'],
      description: 'Max rows for on_or_before / on_or_after; null to use default cap',
    },
  },
  required: ['mode', 'dates', 'count', 'start', 'end', 'bound', 'limit'],
  additionalProperties: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = PostgrestFilterBuilder<any, any, any, any, any>;

export function applyTemporal(
  query: QueryBuilder,
  spec: TemporalSpec,
  dateColumn: DateColumn
): QueryBuilder {
  switch (spec.mode) {
    case 'explicit_dates':
      return query.in(dateColumn, spec.dates);
    case 'latest':
      return query.order(dateColumn, { ascending: false }).limit(spec.count);
    case 'range':
      return query.gte(dateColumn, spec.start).lte(dateColumn, spec.end).order(dateColumn, {
        ascending: false,
      });
    case 'on_or_before': {
      const limit = Math.min(spec.limit ?? MAX_ROWS_PER_TOOL, MAX_ROWS_PER_TOOL);
      return query
        .lte(dateColumn, spec.bound)
        .order(dateColumn, { ascending: false })
        .limit(limit);
    }
    case 'on_or_after': {
      const limit = Math.min(spec.limit ?? MAX_ROWS_PER_TOOL, MAX_ROWS_PER_TOOL);
      return query
        .gte(dateColumn, spec.bound)
        .order(dateColumn, { ascending: false })
        .limit(limit);
    }
    default:
      return query;
  }
}

export function filterRowsByTemporal<T extends Record<string, unknown>>(
  rows: T[],
  spec: TemporalSpec,
  dateColumn: DateColumn
): T[] {
  const dateKey = dateColumn;
  switch (spec.mode) {
    case 'explicit_dates': {
      const set = new Set(spec.dates);
      return rows.filter((r) => set.has(String(r[dateKey] ?? '')));
    }
    case 'range':
      return rows.filter((r) => {
        const d = String(r[dateKey] ?? '');
        return d >= spec.start && d <= spec.end;
      });
    case 'on_or_before':
      return rows.filter((r) => String(r[dateKey] ?? '') <= spec.bound);
    case 'on_or_after':
      return rows.filter((r) => String(r[dateKey] ?? '') >= spec.bound);
    default:
      return rows;
  }
}
