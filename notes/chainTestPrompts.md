# chainRunner manual test matrix

Run from home chat while logged in. Check console for tool rounds.

## Recency (no explicit calendar date)

- [ ] "What did I do in my last lift?" → query_gym_sessions latest count 1
- [ ] "When did I last bench press?" → query_gym_sessions latest + exercise_name_contains
- [ ] "What was my most recent field session?" → query_field_sessions latest count 1

## Date-only

- [ ] "What did I do today?" → explicit_dates with device local today
- [ ] "Summarize yesterday's training" → explicit_dates or range

## Semantic / player search

- [ ] "What have I written about pressing?" → query_field_actions semantic_query or search_similar_actions
- [ ] "Find actions where I mention fatigue" → semantic or description_contains
- [ ] "When did I last mention [player]?" → search_player_by_name and/or query_field_actions player_contains + latest
- [ ] "How is Marcus spelled in my logs?" → search_player_by_name

## Combined

- [ ] "Compare my gym session last Tuesday to film notes about shooting"
- [ ] "How did I sleep the night before my last game session?"

## Other domains

- [ ] "What was my training load this week?" → query_training_load range
- [ ] "Show my MASTER note themes" → get_global_note_session MASTER

## Zero-tool / general

- [ ] "What is a good pre-match warm-up?" (should answer without tools, optional disclaimer)

## Edge cases

- [ ] Nonsense date phrasing — should not crash; model may retry tools
- [ ] Empty logs for a date — graceful "no data" style answer
