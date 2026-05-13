import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

/**
 * Ensures the user has nullable "note" FieldSessions rows for MASTER and SKILL
 * (description discriminators). Idempotent: safe to call on each login / sidebar open.
 */
export async function ensureGlobalSessions(userId: string): Promise<void> {
  const { data: rows, error: fetchError } = await supabase
    .from('FieldSessions')
    .select('id, description')
    .eq('user_id', userId)
    .eq('type', 'note')
    .is('date', null);

  if (fetchError) {
    console.error('ensureGlobalSessions: failed to load note sessions:', fetchError);
    return;
  }

  const list = rows ?? [];
  const hasMaster = list.some((r) => r.description === 'MASTER');
  const hasSkill = list.some((r) => r.description === 'SKILL');
  const legacyBlank = list.find(
    (r) => r.description === '' || r.description === null || r.description === undefined
  );

  if (legacyBlank && !hasMaster) {
    const { error: upgradeError } = await supabase
      .from('FieldSessions')
      .update({ description: 'MASTER' })
      .eq('id', legacyBlank.id);

    if (upgradeError) {
      console.error('ensureGlobalSessions: failed to upgrade legacy master row:', upgradeError);
      return;
    }
  }

  const needsMasterInsert = !hasMaster && !legacyBlank;
  if (needsMasterInsert) {
    const { error: insertMasterError } = await supabase.from('FieldSessions').insert([
      {
        id: uuidv4(),
        user_id: userId,
        type: 'note',
        date: null,
        description: 'MASTER',
      },
    ]);

    if (insertMasterError) {
      console.error('ensureGlobalSessions: failed to insert MASTER session:', insertMasterError);
      return;
    }
  }

  if (!hasSkill) {
    const { error: insertSkillError } = await supabase.from('FieldSessions').insert([
      {
        id: uuidv4(),
        user_id: userId,
        type: 'note',
        date: null,
        description: 'SKILL',
      },
    ]);

    if (insertSkillError) {
      console.error('ensureGlobalSessions: failed to insert SKILL session:', insertSkillError);
    }
  }
}
