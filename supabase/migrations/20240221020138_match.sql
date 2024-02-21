CREATE OR REPLACE FUNCTION match_documents_adaptive(
  query_embedding vector(3072),
  match_count int
)
RETURNS SETOF document_sections
LANGUAGE plpgsql
AS $$
DECLARE
  -- You might need to declare variables if you plan to use intermediate results or dynamic SQL
BEGIN
  RETURN QUERY
  WITH shortlist AS (
    SELECT *
    FROM document_sections
    ORDER BY
      sub_vector(embedding, 512)::vector(512) <#> (
        SELECT sub_vector(query_embedding, 512)::vector(512)
      ) ASC
    LIMIT match_count * 8
  )
  SELECT *
  FROM shortlist
  ORDER BY embedding <#> query_embedding ASC
  LIMIT LEAST(match_count, 200);
END;
$$;
