import { supabase } from "@/lib/supabase-client";

export interface ContactRow {
  sessionId: string;
  sessionName: string;
  chatJid: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  isGroup: boolean;
  lastTs: number;
  lastMessage?: string;
  unread: number;
}

export interface ContactListResponse {
  contacts: ContactRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListContactsOpts {
  q?: string;
  kind?: "" | "user" | "group";
  limit?: number;
  offset?: number;
}

function fromRow(row: any): ContactRow {
  const chat = row.chats?.[0];
  return {
    sessionId: row.connection_id,
    sessionName: row.connections?.session_label ?? row.connections?.name ?? "",
    chatJid: row.wa_jid,
    name: row.name ?? row.phone ?? row.wa_jid,
    phone: row.phone ?? "",
    avatarUrl: row.avatar_url ?? undefined,
    isGroup: row.wa_jid?.endsWith("@g.us") ?? false,
    lastTs: chat?.last_message_at ? new Date(chat.last_message_at).getTime() : 0,
    lastMessage: chat?.last_message ?? undefined,
    unread: chat?.unread ?? 0,
  };
}

export const listContacts = async (
  opts: ListContactsOpts = {},
): Promise<ContactListResponse> => {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  let query = supabase
    .from("contacts")
    .select(
      "*, connections(name, session_label), chats(unread, last_message_at, last_message)",
      { count: "exact" },
    )
    .range(offset, offset + limit - 1)
    .order("updated_at", { ascending: false });

  if (opts.q) {
    query = query.or(`name.ilike.%${opts.q}%,phone.ilike.%${opts.q}%`);
  }
  if (opts.kind === "group") query = query.like("wa_jid", "%@g.us");
  if (opts.kind === "user") query = query.not("wa_jid", "like", "%@g.us");

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    contacts: (data ?? []).map(fromRow),
    total: count ?? 0,
    limit,
    offset,
  };
};

export interface CreateContactInput {
  sessionId: string;
  phone: string;
  name: string;
  avatar?: File | null;
}

export const createContact = async (input: CreateContactInput): Promise<ContactRow> => {
  let avatarUrl: string | undefined;

  if (input.avatar) {
    avatarUrl = await uploadAvatar(input.avatar);
  }

  const waJid = `${input.phone.replace(/\D/g, "")}@s.whatsapp.net`;

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      connection_id: input.sessionId,
      wa_jid: waJid,
      name: input.name,
      phone: input.phone,
      avatar_url: avatarUrl,
    })
    .select("*, connections(name, session_label)")
    .single();
  if (error) throw error;
  return fromRow(data);
};

export interface UpdateContactInput {
  name?: string;
  avatar?: File | null;
  clearAvatar?: boolean;
}

export const updateContact = async (
  sessionId: string,
  chatJid: string,
  input: UpdateContactInput,
): Promise<void> => {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.clearAvatar) patch.avatar_url = null;
  else if (input.avatar) patch.avatar_url = await uploadAvatar(input.avatar);

  const { error } = await supabase
    .from("contacts")
    .update(patch)
    .eq("connection_id", sessionId)
    .eq("wa_jid", chatJid);
  if (error) throw error;
};

export const deleteContact = async (sessionId: string, chatJid: string): Promise<void> => {
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("connection_id", sessionId)
    .eq("wa_jid", chatJid);
  if (error) throw error;
};

async function uploadAvatar(file: File): Promise<string> {
  const path = `avatars/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
  return data.publicUrl;
}