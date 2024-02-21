create or replace function match_documents_adaptive(
  query_embedding vector(3072),
  match_count int
)
returns setof document_sections
language plpgsql
as $$
begin
  select *
  from document_sections
  where id in (
    select *
    from document_sections
    order by
      sub_vector(embedding, 512)::vector(512) <#> (
        select sub_vector(query_embedding, 512)::vector(512)
      ) asc
    limit match_count * 8
  )
  order by embedding <#> query_embedding asc
  limit least(match_count, 200);
end;
$$;
