*** Search Strategy ***

Implemented in `lib/chain/` (orchestrated by `chainRunner.ts`).

## Architecture

- **OpenAI Responses API** (`gpt-4o-mini`) with function tools (in-bundle MCP-style loop).
- **Zod** validates every tool call before Supabase access.
- **Shared `TemporalSpec`** on query tools: `explicit_dates`, `latest`, `range`, `on_or_before`, `on_or_after`.
- **Max 5** tool rounds per user query; tools may run in parallel within a round.

## Tools

| Tool | Purpose |
|------|---------|
| `query_gym_sessions` | GymSessions; latest/recency; optional exercise JSONB scan (50-session cap) |
| `query_field_sessions` | FieldSessions with temporal + optional type filter |
| `query_field_actions` | FieldActions: temporal, text filters, or semantic_query (embedding) |
| `query_sleep` | Sleep rows by temporal |
| `query_training_load` | TrainingLoad by temporal (deduped per date) |
| `search_similar_actions` | Embedding + `search_similar_actions` RPC |
| `get_global_note_session` | MASTER / SKILL (`date` null) |
| `search_exercises_by_name` | GymExercises catalog |
| `search_player_by_name` | Distinct `player_mentions` on FieldActions (ilike) |

## Manual test matrix

See `notes/chainTestPrompts.md`.

## Known follow-ups

- `Sleep.date` is globally UNIQUE in DB (not per user).
- Postgres RPC for full-history gym exercise search (optional phase 2).
