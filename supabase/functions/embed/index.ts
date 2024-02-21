import { createClient } from "@supabase/supabase-js";
// import { env, pipeline } from "@xenova/transformers";
import { OpenAI } from "openai";
import { Database } from "../_lib/database.ts";

// Configuration for Deno runtime
// env.useBrowserCache = false;
// env.allowLocalModels = false;

// const generateEmbedding = await pipeline(
//   "feature-extraction",
//   "Supabase/gte-small",
// );

const openAiKey = Deno.env.get("OPENAI_API_KEY");
const openai = new OpenAI({ apiKey: openAiKey });

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

Deno.serve(async (req) => {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: "Missing environment variables.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return new Response(
        JSON.stringify({ error: `No authorization header passed` }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          authorization,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const { ids, table, contentColumn, embeddingColumn } = await req.json();

    const { data: rows, error: selectError } = await supabase
      .from(table)
      .select(`id, ${contentColumn}` as "*")
      .in("id", ids)
      .is(embeddingColumn, null);

    if (selectError) {
      return new Response(JSON.stringify({ error: selectError }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    for (const row of rows) {
      const { id, [contentColumn]: content } = row;

      if (!content) {
        console.error(`No content available in column '${contentColumn}'`);
        continue;
      }

      const {
        data: [{ embedding }],
      } = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: content,
      });

      const { error } = await supabase
        .from(table)
        .update({
          [embeddingColumn]: JSON.stringify(Array.from(embedding)),
        })
        .eq("id", id);

      if (error) {
        console.error(
          error,
          `Failed to save embedding on '${table}' table with id ${id}`,
        );
      }

      console.log(
        `Generated embedding ${
          JSON.stringify({
            table,
            id,
            contentColumn,
            embeddingColumn,
          })
        }`,
      );
    }

    return new Response(null, {
      status: 204,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
