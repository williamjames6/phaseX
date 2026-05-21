// RAG / agent logic for home chat — orchestrated via lib/chain (Responses API + tools)
import type OpenAI from 'openai';
import { runAgent } from './lib/chain';
import type { ChainSupabase } from './lib/chain/types';

export async function chainRunner(
  query: string,
  supabase: ChainSupabase,
  openaiClient: OpenAI
): Promise<{ assistantText: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  return runAgent({ query, supabase, openaiClient });
}
