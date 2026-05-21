import { truncateDeep } from './truncate';
import { TOOL_BY_NAME } from './toolSchemas';
import type { PendingFunctionCall, ToolContext } from './types';

export interface FunctionCallOutputItem {
  type: 'function_call_output';
  call_id: string;
  output: string;
}

function buildOutput(callId: string, payload: unknown): FunctionCallOutputItem {
  return {
    type: 'function_call_output',
    call_id: callId,
    output: JSON.stringify(truncateDeep(payload)),
  };
}

export async function executeFunctionCalls(
  calls: PendingFunctionCall[],
  ctx: ToolContext
): Promise<FunctionCallOutputItem[]> {
  return Promise.all(
    calls.map(async (call) => {
      const def = TOOL_BY_NAME.get(call.name);
      if (!def) {
        return buildOutput(call.call_id, { error: 'unknown_tool', name: call.name });
      }

      let raw: unknown;
      try {
        raw = JSON.parse(call.arguments);
      } catch {
        return buildOutput(call.call_id, { error: 'invalid_json' });
      }

      const parsed = def.schema.safeParse(raw);
      if (!parsed.success) {
        return buildOutput(call.call_id, {
          error: 'validation_failed',
          issues: parsed.error.flatten(),
        });
      }

      try {
        const result = await def.handler(parsed.data, ctx);
        return buildOutput(call.call_id, { ok: true, data: result });
      } catch (err) {
        console.error(`Tool ${call.name} failed:`, err);
        const message = err instanceof Error ? err.message : 'tool_execution_failed';
        return buildOutput(call.call_id, { error: message });
      }
    })
  );
}
