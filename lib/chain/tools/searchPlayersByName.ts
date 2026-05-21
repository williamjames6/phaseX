import { MAX_ROWS_PER_TOOL } from '../constants';
import type { ToolContext } from '../types';

export async function searchPlayersByName(
  args: { query: string; limit?: number },
  ctx: ToolContext
): Promise<{ player_mentions: string[] }> {
  const limit = Math.min(args.limit ?? 20, MAX_ROWS_PER_TOOL);
  const pattern = `%${args.query.replace(/%/g, '\\%')}%`;

  const { data, error } = await ctx.supabase
    .from('FieldActions')
    .select('player_mentions')
    .not('player_mentions', 'is', null)
    .ilike('player_mentions', pattern)
    .limit(limit);

  if (error) {
    console.error('search_player_by_name:', error);
    return { player_mentions: [] };
  }

  const seen = new Set<string>();
  const player_mentions: string[] = [];
  for (const row of data ?? []) {
    const mention = row.player_mentions as string | null;
    if (!mention?.trim() || seen.has(mention)) continue;
    seen.add(mention);
    player_mentions.push(mention);
  }

  return { player_mentions };
}
