import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "generated/db.js";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { ArxivPaperNote } from "prompt.js";

export class SupabaseDatabase {
  vectorStore: SupabaseVectorStore;
  client: SupabaseClient<Database,  "public", any>;
  
  constructor(client: SupabaseClient<Database, "public", any>, vectorStore: SupabaseVectorStore) { 
    this.client = client; 
    this.vectorStore = vectorStore;
  }

  static async fromDocuments(documents: Document[]): Promise<SupabaseDatabase> {
    const privateKey = process.env.SUPABASE_PRIVATE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!privateKey || !supabaseUrl) {
      throw new Error('Missing Supabase environment variables')
    }
    const supabase = createClient(supabaseUrl, privateKey);
    
    const vectorStore = await SupabaseVectorStore.fromDocuments(documents, new OpenAIEmbeddings(), {
      client: supabase,
      tableName: "arxiv_embeddings",
      queryName: "match_documents",
    });
    return new this(supabase, vectorStore);
  }

  async addPaper({
    paper,
    url,
    notes,
    name,
  }: {
    paper: string;
    url: string;
    notes: Array<ArxivPaperNote>;
    name: string;
  }) {
    const {data, error } = await this.client.from("arxiv_papers").insert([
      {
        paper,
        arxiv_url: url,
        notes,
        name,
      },
    ]);
    if (error) {
      throw new Error(
        "Error adding paper to database" + JSON.stringify(error, null, 2)
      );
    }
    console.log("🚀 ~ SupabaseDatabase ~ data:", data)
  }
}