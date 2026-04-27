import { supabase } from "@/integrations/supabase/client";

// v2 uses the same Supabase auth pool but tags accounts with app_version='v2' in user_metadata.
// A v2 account is one that has a row in v2_profiles.

async function ensureV2Profile(userId: string, username: string) {
  const { data: existing } = await supabase
    .from("v2_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return;
  await supabase.from("v2_profiles").insert({ id: userId, display_name: username });
  await supabase.from("v2_user_roles").insert({ user_id: userId, role: "user" as any });
  await supabase.from("v2_settings").insert({ user_id: userId });
}

export async function v2SignUp(email: string, password: string, username: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/v2/dashboard`,
      data: { app_version: "v2", username },
    },
  });
  if (error) throw error;

  // If Supabase returned a user but no session, the email likely already exists
  // (Supabase silently "succeeds" to prevent enumeration). Try signing in with
  // the supplied password and link/create a v2 profile if it works.
  if (!data.session) {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      throw new Error("An account with this email already exists. Sign in instead, or use the correct password to link it to Nebula.");
    }
    await ensureV2Profile(signInData.user.id, username || email.split("@")[0]);
    return signInData;
  }

  // Fresh signup — trigger creates the profile, but ensure as a safety net.
  if (data.user) await ensureV2Profile(data.user.id, username || email.split("@")[0]);
  return data;
}

export async function v2SignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Verify this is actually a v2 account; if not but credentials are valid,
  // auto-link by creating a v2 profile (user explicitly logged into /v2).
  const { data: profile } = await supabase
    .from("v2_profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) {
    await ensureV2Profile(data.user.id, (data.user.email || "user").split("@")[0]);
  }
  return data;
}

export async function v2SignOut() {
  await supabase.auth.signOut();
}

export async function getV2Profile(userId: string) {
  const { data } = await supabase
    .from("v2_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
}
