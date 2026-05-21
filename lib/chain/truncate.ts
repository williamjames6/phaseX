import { MAX_DESCRIPTION_CHARS } from './constants';

export function truncateDescription(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_DESCRIPTION_CHARS) {
    return `${value.slice(0, MAX_DESCRIPTION_CHARS)}…`;
  }
  return value;
}

export function truncateDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(truncateDeep);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'description' && typeof v === 'string') {
        out[k] = truncateDescription(v);
      } else {
        out[k] = truncateDeep(v);
      }
    }
    return out;
  }
  return value;
}
