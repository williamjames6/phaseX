import { MAX_ROWS_PER_TOOL } from '../constants';
import type { ToolContext } from '../types';

export async function getGlobalNoteSession(
  args: { kind: 'MASTER' | 'SKILL' },
  ctx: ToolContext
): Promise<{ session: Record<string, unknown> | null; actions: Record<string, unknown>[] }> {
  const { data: rows, error: notesError } = await ctx.supabase
    .from('Notes')
    .select('id, type, description, note')
    .is('date', null)
    .eq('type', 'global')
    .eq('description', args.kind)
    .limit(MAX_ROWS_PER_TOOL);

  if (notesError) {
    console.error('get_global_note_session notes:', notesError);
    return { session: null, actions: [] };
  }

  const list = rows ?? [];
  if (list.length === 0) {
    return { session: null, actions: [] };
  }

  const session = {
    id: list[0].id,
    type: list[0].type,
    description: list[0].description,
    note: null,
  };

  const actions = list.map((row) => ({
    id: row.id,
    description: row.note,
    sketch_id: null,
  }));

  return { session, actions };
}
