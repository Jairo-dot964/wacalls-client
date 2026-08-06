import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ojawpqoiorxiskdiwfyh.supabase.co";
const supabaseAnonKey = "sb_publishable_EhSEBtJAfGj743aSGtzLDQ_Solu1tBN";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function callEdgeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}