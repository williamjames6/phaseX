import type OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

export type ChainSupabase = SupabaseClient;

export interface ToolContext {
  supabase: ChainSupabase;
  openaiClient: OpenAI;
  localDate: string;
}

export interface ChainResult {
  assistantText: string;
}

export interface OpenAIFunctionTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: boolean;
}

export interface ToolDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: T;
  parameters: Record<string, unknown>;
  handler: (args: z.infer<T>, ctx: ToolContext) => Promise<unknown>;
}

export interface PendingFunctionCall {
  call_id: string;
  name: string;
  arguments: string;
}
