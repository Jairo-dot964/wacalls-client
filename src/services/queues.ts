import { supabase } from "@/lib/supabase-client";
import type { Queue } from "@/types/queue";

function fromRow(row: any): Queue {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: new Date(row.created_at).getTime(),
    greeting: row.description ?? "",
  };
}

export const listQueues = async (): Promise<Queue[]> => {
  const { data, error } = await supabase
    .from("queues")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
};

export const createQueue = async (name: string, color: string): Promise<Queue> => {
  const { data, error } = await supabase
    .from("queues")
    .insert({ name, color })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
};

export const deleteQueue = async (id: string): Promise<void> => {
  const { error } = await supabase.from("queues").delete().eq("id", id);
  if (error) throw error;
};

export type QueueExtrasPayload = {
  orderBot?: string;
  closeTicket?: boolean;
  rotation?: boolean;
  rotationInterval?: string;
  rotationMode?: string;
  autoRandomize?: boolean;
  agentId?: string;
  greeting?: string;
};

export const updateQueue = async (
  id: string,
  name: string,
  color: string,
  extras: QueueExtrasPayload = {},
): Promise<void> => {
  const { error } = await supabase
    .from("queues")
    .update({ name, color, description: extras.greeting ?? null })
    .eq("id", id);
  if (error) throw error;
};