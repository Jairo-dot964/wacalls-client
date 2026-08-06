import { supabase } from "@/lib/supabase-client";
import type { AuthUser, MeResponse, SignupPayload } from "@/types/auth";

async function buildAuthUser(userId: string, email: string): Promise<AuthUser> {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return {
    id: userId,
    email,
    name: profile?.name ?? undefined,
    roles: profile?.roles ?? ["user"],
    companyName: profile?.company_name ?? undefined,
  };
}

export const me = async (): Promise<MeResponse> => {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user) return { user: null };
  const user = await buildAuthUser(session.user.id, session.user.email ?? "");
  return { user };
};

export const login = async (email: string, password: string): Promise<AuthUser> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return buildAuthUser(data.user.id, data.user.email ?? email);
};

export type SignupResult =
  | { user: AuthUser; needsVerification?: false }
  | { needsVerification: true; email: string; devCode?: string };

export const signup = async (payload: SignupPayload): Promise<SignupResult> => {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
  });
  if (error) throw new Error(error.message);

  if (!data.session || !data.user) {
    return { needsVerification: true, email: payload.email };
  }

  await supabase
    .from("profiles")
    .update({ company_name: payload.companyName })
    .eq("id", data.user.id);

  const user = await buildAuthUser(data.user.id, data.user.email ?? payload.email);
  return { user };
};

export const verifyEmail = async (email: string, _code: string): Promise<AuthUser> => {
  const r = await me();
  if (!r.user) throw new Error("E-mail ainda não confirmado. Confira o link enviado por e-mail.");
  return r.user;
};

export const resendActivationCode = async (email: string) => {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw new Error(error.message);
  return { ok: true };
};

export const logout = async (): Promise<void> => {
  await supabase.auth.signOut();
};

export const forgotPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
  return { ok: true, message: "Se o e-mail existir, enviamos um link de redefinição." };
};

export const resetPassword = async (_token: string, newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  return { ok: true };
};

export const listUsers = async (): Promise<AuthUser[]> => {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name ?? undefined,
    roles: p.roles ?? ["user"],
    companyName: p.company_name ?? undefined,
  }));
};

export const setRole = async (id: string, role: "admin" | "user", grant: boolean) => {
  const { data: profile, error: findErr } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", id)
    .single();
  if (findErr) throw new Error(findErr.message);

  const current: string[] = profile?.roles ?? ["user"];
  const next = grant ? Array.from(new Set([...current, role])) : current.filter((r) => r !== role);

  const { error } = await supabase.from("profiles").update({ roles: next }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: "updated" };
};

export const deleteUser = async (id: string): Promise<void> => {
  const { error } = await supabase.functions.invoke("admin-users", {
    body: { action: "delete", user_id: id },
  });
  if (error) throw new Error(error.message);
};

export const createUser = async (payload: {
  email: string;
  password: string;
  name?: string;
  companyName?: string;
  roles?: string[];
}): Promise<AuthUser> => {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "create", ...payload },
  });
  if (error) throw new Error(error.message);
  return data as AuthUser;
};