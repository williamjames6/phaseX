import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

/**
 * Ensures the user has global Notes rows for MASTER and SKILL.
 * Idempotent: safe to call on each login / sidebar open.
 */
export async function ensureGlobalSessions(userId: string): Promise<void> {
  // Remove stray note/global FieldSessions recreated by pre-migration client code.
  const { data: straySessions, error: strayError } = await supabase
    .from('FieldSessions')
    .select('id')
    .eq('user_id', userId)
    .in('type', ['note', 'global']);

  if (strayError) {
    console.error('ensureGlobalSessions: failed to load stray field sessions:', strayError);
  } else if (straySessions && straySessions.length > 0) {
    const strayIds = straySessions.map((row) => row.id);
    const { error: deleteActionsError } = await supabase
      .from('FieldActions')
      .delete()
      .in('session_id', strayIds);

    if (deleteActionsError) {
      console.error('ensureGlobalSessions: failed to delete stray field actions:', deleteActionsError);
    } else {
      const { error: deleteSessionsError } = await supabase
        .from('FieldSessions')
        .delete()
        .in('id', strayIds);

      if (deleteSessionsError) {
        console.error('ensureGlobalSessions: failed to delete stray field sessions:', deleteSessionsError);
      }
    }
  }

  const { data: rows, error: fetchError } = await supabase
    .from('Notes')
    .select('id, description')
    .eq('user_id', userId)
    .eq('type', 'global')
    .is('date', null);

  if (fetchError) {
    console.error('ensureGlobalSessions: failed to load global notes:', fetchError);
    return;
  }

  const list = rows ?? [];
  const hasMaster = list.some((r) => r.description === 'MASTER');
  const hasSkill = list.some((r) => r.description === 'SKILL');

  if (!hasMaster) {
    const { error: insertMasterError } = await supabase.from('Notes').insert([
      {
        id: uuidv4(),
        user_id: userId,
        type: 'global',
        date: null,
        description: 'MASTER',
        note: '',
      },
    ]);

    if (insertMasterError) {
      console.error('ensureGlobalSessions: failed to insert MASTER note:', insertMasterError);
      return;
    }
  }

  if (!hasSkill) {
    const { error: insertSkillError } = await supabase.from('Notes').insert([
      {
        id: uuidv4(),
        user_id: userId,
        type: 'global',
        date: null,
        description: 'SKILL',
        note: '',
      },
    ]);

    if (insertSkillError) {
      console.error('ensureGlobalSessions: failed to insert SKILL note:', insertSkillError);
    }
  }
}
