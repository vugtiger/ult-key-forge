import { supabase } from "@/integrations/supabase/client";

// v2 uses the same Supabase auth pool but tags accounts with app_version='v2' in user_metadata.
// A v2 account is one that has a row in v2_profiles.

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
  return data;
}

export async function v2SignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Verify this is actually a v2 account
  const { data: profile } = await supabase
    .from("v2_profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error("This account is not registered on v2. Please sign up.");
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
