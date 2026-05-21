/**
 * Agent loop via OpenAI Responses API (gpt-4o-mini, non-reasoning).
 * Reasoning models would require passing reasoning output items back on each turn; not used here.
 */
import type OpenAI from 'openai';
import type { Response } from 'openai/resources/responses/responses';
import { CHAT_MODEL, MAX_TOOL_ROUNDS } from './constants';
import { buildInstructions, getLocalDateString } from './prompts';
import { executeFunctionCalls } from './toolExecutor';
import { OPENAI_TOOLS } from './toolSchemas';
import type { ChainResult, ChainSupabase, PendingFunctionCall } from './types';

export interface RunAgentParams {
  query: string;
  supabase: ChainSupabase;
  openaiClient: OpenAI;
}

function extractFunctionCalls(response: Response): PendingFunctionCall[] {
  const calls: PendingFunctionCall[] = [];
  for (const item of response.output ?? []) {
    const row = item as {
      type?: string;
      call_id?: string;
      name?: string;
      arguments?: string;
    };
    if (row.type === 'function_call' && row.call_id && row.name) {
      calls.push({
        call_id: row.call_id,
        name: row.name,
        arguments: row.arguments ?? '{}',
      });
    }
  }
  return calls;
}

function extractAssistantText(response: Response): string | null {
  if (response.output_text?.trim()) {
    return response.output_text.trim();
  }
  for (const item of response.output ?? []) {
    const row = item as { type?: string; content?: { type?: string; text?: string }[] };
    if (row.type === 'message' && Array.isArray(row.content)) {
      const parts = row.content
        .filter((c) => c.type === 'output_text' && c.text)
        .map((c) => c.text as string);
      if (parts.length > 0) {
        return parts.join('\n').trim();
      }
    }
  }
  return null;
}

export async function runAgent({
  query,
  supabase,
  openaiClient,
}: RunAgentParams): Promise<ChainResult> {
  const localDate = getLocalDateString();
  const ctx = { supabase, openaiClient, localDate };
  const instructions = buildInstructions(localDate);

  // With store: false, previous_response_id is not valid — replay output + tool results in input each round.
  let inputItems: Array<Record<string, unknown>> = [{ role: 'user', content: query }];

  let response = await openaiClient.responses.create({
    model: CHAT_MODEL,
    instructions,
    input: inputItems,
    tools: OPENAI_TOOLS,
    tool_choice: 'auto',
    parallel_tool_calls: true,
    store: false,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = extractFunctionCalls(response);
    if (calls.length === 0) {
      const text = extractAssistantText(response);
      if (text) {
        return { assistantText: text };
      }
      break;
    }

    const outputs = await executeFunctionCalls(calls, ctx);

    inputItems = [...inputItems, ...(response.output ?? []), ...outputs];

    response = await openaiClient.responses.create({
      model: CHAT_MODEL,
      instructions,
      input: inputItems,
      tools: OPENAI_TOOLS,
      tool_choice: 'auto',
      parallel_tool_calls: true,
      store: false,
    });
  }

  const finalText = extractAssistantText(response);
  if (finalText) {
    return { assistantText: finalText };
  }

  return {
    assistantText:
      "I couldn't finish looking up your data. Try rephrasing your question or asking about a specific day.",
  };
}
