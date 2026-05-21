import { MAX_ROWS_PER_TOOL } from '../constants';
import type { ToolContext } from '../types';

export async function getGlobalNoteSession(
  args: { kind: 'MASTER' | 'SKILL' },
  ctx: ToolContext
): Promise<{ session: Record<string, unknown> | null; actions: Record<string, unknown>[] }> {
  const { data: session, error: sessionError } = await ctx.supabase
    .from('FieldSessions')
    .select('id, type, description, note')
    .is('date', null)
    .eq('type', 'note')
    .eq('description', args.kind)
    .maybeSingle();

  if (sessionError) {
    console.error('get_global_note_session session:', sessionError);
    return { session: null, actions: [] };
  }

  if (!session?.id) {
    return { session: null, actions: [] };
  }

  const { data: actions, error: actionsError } = await ctx.supabase
    .from('FieldActions')
    .select('id, description, sketch_id')
    .eq('session_id', session.id)
    .is('time_stamp_seconds', null)
    .limit(MAX_ROWS_PER_TOOL);

  if (actionsError) {
    console.error('get_global_note_session actions:', actionsError);
    return { session, actions: [] };
  }

  return { session, actions: actions ?? [] };
}
