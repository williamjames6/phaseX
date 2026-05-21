import { timeSwitch } from '../../../assets/helpers/timeSwitch';
import {
  DEFAULT_SIMILAR_LIMIT,
  EMBEDDING_MODEL,
  SIMILAR_MATCH_THRESHOLD,
} from '../constants';
import type { ToolContext } from '../types';

export async function searchSimilarActions(
  args: { query: string; limit?: number },
  ctx: ToolContext
): Promise<{
  actions: {
    session_date: string | null;
    time: string;
    description: string | null;
    similarity: number;
  }[];
}> {
  const limit = args.limit ?? DEFAULT_SIMILAR_LIMIT;

  const embeddingResponse = await ctx.openaiClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: args.query,
  });

  const embedding = Array.from(embeddingResponse.data[0].embedding);
  if (embedding.length !== 1536) {
    return { actions: [] };
  }

  const { data, error } = await ctx.supabase.rpc('search_similar_actions', {
    query_embedding: embedding,
    match_threshold: SIMILAR_MATCH_THRESHOLD,
    match_count: limit,
  });

  if (error) {
    console.error('search_similar_actions:', error);
    throw error;
  }

  const actions = (data ?? []).map(
    (row: {
      session_date: string | null;
      time_stamp_seconds: number | null;
      description: string | null;
      similarity: number;
    }) => ({
      session_date: row.session_date,
      time: timeSwitch(row.time_stamp_seconds) as string,
      description: row.description,
      similarity: row.similarity,
    })
  );

  return { actions };
}
