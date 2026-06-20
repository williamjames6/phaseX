import { getGlobalNoteSession } from './tools/getGlobalNoteSession';
import { truncateDescription } from './truncate';
import type { ChainSupabase, ToolContext } from './types';

const MAX_ACTIONS_IN_INSTRUCTIONS = 25;

function formatSessionSection(
  kind: 'MASTER' | 'SKILL',
  data: Awaited<ReturnType<typeof getGlobalNoteSession>>
): string {
  if (!data.session) {
    return `### ${kind}\n(not configured — user has no global ${kind} session yet)`;
  }

  const note =
    typeof data.session.note === 'string' && data.session.note.trim()
      ? (truncateDescription(data.session.note) as string)
      : '(empty)';

  const actionLines = (data.actions ?? [])
    .slice(0, MAX_ACTIONS_IN_INSTRUCTIONS)
    .map((row, index) => {
      const description =
        typeof row.description === 'string' && row.description.trim()
          ? (truncateDescription(row.description) as string)
          : '(empty)';
      return `${index + 1}. ${description}`;
    });

  const actionsBlock =
    actionLines.length > 0
      ? actionLines.join('\n')
      : '(no note actions logged)';

  const totalActions = data.actions?.length ?? 0;
  const truncatedSuffix =
    totalActions > MAX_ACTIONS_IN_INSTRUCTIONS
      ? `\n(showing first ${MAX_ACTIONS_IN_INSTRUCTIONS} of ${totalActions} actions)`
      : '';

  return `### ${kind}\nSession note: ${note}\nNote actions:\n${actionsBlock}${truncatedSuffix}`;
}

/** Loads MASTER/SKILL global note sessions for injection into agent instructions. */
export async function buildGlobalSessionsContextBlock(
  supabase: ChainSupabase,
  localDate: string
): Promise<string> {
  const ctx = { supabase, localDate } as ToolContext;

  const [master, skill] = await Promise.all([
    getGlobalNoteSession({ kind: 'MASTER' }, ctx),
    getGlobalNoteSession({ kind: 'SKILL' }, ctx),
  ]);

  return (
    '## Global note sessions (always in context)\n' +
    'MASTER = north-star themes; SKILL = skill/doc notes. Use these to align answers; call get_global_note_session if you need a refresh.\n\n' +
    `${formatSessionSection('MASTER', master)}\n\n` +
    `${formatSessionSection('SKILL', skill)}`
  );
}
