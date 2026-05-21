import { z } from 'zod';
import type { FunctionTool } from 'openai/resources/responses/responses';
import type { ToolDefinition } from './types';
import { TEMPORAL_JSON_SCHEMA, temporalInputSchema } from './temporal';
import { getGlobalNoteSession } from './tools/getGlobalNoteSession';
import { queryFieldActions } from './tools/queryFieldActions';
import { queryFieldSessions } from './tools/queryFieldSessions';
import { queryGymSessions } from './tools/queryGymSessions';
import { querySleep } from './tools/querySleep';
import { queryTrainingLoad } from './tools/queryTrainingLoad';
import { searchExercisesByName } from './tools/searchExercisesByName';
import { searchPlayersByName } from './tools/searchPlayersByName';
import { searchSimilarActions } from './tools/searchSimilarActions';

const limitSchema = z.number().int().min(1).max(50).optional();
const globalNoteKindSchema = z.enum(['MASTER', 'SKILL']);

const queryGymInput = z.object({
  temporal: temporalInputSchema,
  exercise_name_contains: z.string().min(1).max(200).nullable(),
});

const queryFieldSessionsInput = z.object({
  temporal: temporalInputSchema,
  session_type: z.string().min(1).max(100).nullable(),
});

const queryFieldActionsInput = z.object({
  temporal: temporalInputSchema,
  semantic_query: z.string().min(1).max(2000).nullable(),
  description_contains: z.string().min(1).max(200).nullable(),
  player_contains: z.string().min(1).max(200).nullable(),
});

const querySleepInput = z.object({
  temporal: temporalInputSchema,
});

const queryTrainingLoadInput = z.object({
  temporal: temporalInputSchema,
});

const searchSimilarInput = z.object({
  query: z.string().min(1).max(2000),
  limit: limitSchema,
});

const globalNoteInput = z.object({
  kind: globalNoteKindSchema,
});

const searchExercisesInput = z.object({
  query: z.string().min(1).max(200),
  limit: limitSchema,
});

const searchPlayersInput = z.object({
  query: z.string().min(1).max(200),
  limit: limitSchema,
});

/** With strict: true, every key in parameters.properties must be listed in required. */
function toFunctionTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>
): FunctionTool {
  return {
    type: 'function',
    name,
    description,
    parameters,
    strict: true,
  };
}

const nullableString = (description: string) => ({
  type: ['string', 'null'] as const,
  description,
});

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'query_gym_sessions',
    description:
      'Gym lifts/workouts. Use temporal.mode "latest" with count 1 for "last lift". ' +
      'For "when did I last bench press", use latest count 1 plus exercise_name_contains (scans up to 50 recent sessions). ' +
      'Pass null for exercise_name_contains when not filtering by exercise.',
    schema: queryGymInput,
    parameters: {
      type: 'object',
      properties: {
        temporal: TEMPORAL_JSON_SCHEMA,
        exercise_name_contains: nullableString(
          'Substring to match exercise names in session JSONB; null if not filtering'
        ),
      },
      required: ['temporal', 'exercise_name_contains'],
      additionalProperties: false,
    },
    handler: (args, ctx) => queryGymSessions(args, ctx),
  },
  {
    name: 'query_field_sessions',
    description:
      'High-level field session scores and notes. Use temporal for dates or latest game/training session.',
    schema: queryFieldSessionsInput,
    parameters: {
      type: 'object',
      properties: {
        temporal: TEMPORAL_JSON_SCHEMA,
        session_type: nullableString('Filter by session type substring; null if not filtering'),
      },
      required: ['temporal', 'session_type'],
      additionalProperties: false,
    },
    handler: (args, ctx) => queryFieldSessions(args, ctx),
  },
  {
    name: 'query_field_actions',
    description:
      'Film/training actions. Use semantic_query for thematic search (embedding); otherwise use temporal plus description_contains or player_contains. ' +
      'Pass null for unused filters.',
    schema: queryFieldActionsInput,
    parameters: {
      type: 'object',
      properties: {
        temporal: TEMPORAL_JSON_SCHEMA,
        semantic_query: nullableString('Embedding search text; null if using date/text filters only'),
        description_contains: nullableString('Substring in action description; null if unused'),
        player_contains: nullableString('Substring in player_mentions; null if unused'),
      },
      required: ['temporal', 'semantic_query', 'description_contains', 'player_contains'],
      additionalProperties: false,
    },
    handler: (args, ctx) => queryFieldActions(args, ctx),
  },
  {
    name: 'query_sleep',
    description: 'Sleep logs. Use temporal explicit_dates, range, or latest as appropriate.',
    schema: querySleepInput,
    parameters: {
      type: 'object',
      properties: {
        temporal: TEMPORAL_JSON_SCHEMA,
      },
      required: ['temporal'],
      additionalProperties: false,
    },
    handler: (args, ctx) => querySleep(args, ctx),
  },
  {
    name: 'query_training_load',
    description: 'Garmin training load (TRIMP, aerobic/anaerobic effect) for a temporal window.',
    schema: queryTrainingLoadInput,
    parameters: {
      type: 'object',
      properties: {
        temporal: TEMPORAL_JSON_SCHEMA,
      },
      required: ['temporal'],
      additionalProperties: false,
    },
    handler: (args, ctx) => queryTrainingLoad(args, ctx),
  },
  {
    name: 'search_similar_actions',
    description: 'Semantic search over action descriptions when the question is thematic, not date-specific.',
    schema: searchSimilarInput,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text from the user question' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: (args, ctx) => searchSimilarActions(args, ctx),
  },
  {
    name: 'get_global_note_session',
    description: 'Load the persistent MASTER (north star) or SKILL (doc) note session (date is null).',
    schema: globalNoteInput,
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['MASTER', 'SKILL'] },
      },
      required: ['kind'],
      additionalProperties: false,
    },
    handler: (args, ctx) => getGlobalNoteSession(args, ctx),
  },
  {
    name: 'search_exercises_by_name',
    description: 'Search the shared gym exercise catalog by name (not logged session history).',
    schema: searchExercisesInput,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Substring to match against exercise names' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: (args, ctx) => searchExercisesByName(args, ctx),
  },
  {
    name: 'search_player_by_name',
    description:
      'Search logged player_mentions on field actions by name substring. ' +
      'Use to resolve how a player is spelled in logs or before filtering actions by player.',
    schema: searchPlayersInput,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Substring to match against player_mentions' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: (args, ctx) => searchPlayersByName(args, ctx),
  },
];

export const TOOL_BY_NAME = new Map(TOOL_DEFINITIONS.map((d) => [d.name, d]));

export const OPENAI_TOOLS: FunctionTool[] = TOOL_DEFINITIONS.map((d) =>
  toFunctionTool(d.name, d.description, d.parameters)
);
