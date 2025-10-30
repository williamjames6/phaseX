CREATE OR REPLACE FUNCTION search_similar_actions(
  query_embedding vector, -- Adjust dimension based on your embedding model
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  description text,
  similarity float,
  session_id uuid,
  time_stamp_seconds integer,
  session_date date
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.description,
    cosine_similarity(a.description_embedding, query_embedding) as similarity,
    a.session_id,
    a.time_stamp_seconds,
    a.session_date
  FROM "Actions" a
  WHERE a.description_embedding IS NOT NULL
    AND cosine_similarity(a.description_embedding, query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;