// Nebula public REST API — key generation, validation, revocation, HWID reset
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const generateKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `NBL-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 14)}`;
};

async function authToken(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  const { data } = await supabase.from("v2_api_tokens").select("*").eq("token", token).maybeSingle();
  if (data) {
    supabase.from("v2_api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then();
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // strip the function name from path
  const path = url.pathname.replace(/^\/nebula-api/, "").replace(/^\/+|\/+$/g, "");

  try {
    const tok = await authToken(req);
    if (!tok) return json({ error: "Invalid or missing API token" }, 401);

    // POST /keys/generate { project, amount, days }
    if (path === "keys/generate" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { project, amount = 1, days = 30, note } = body;
      if (!project) return json({ error: "project required" }, 400);

      const { data: proj } = await supabase.from("v2_projects")
        .select("*").eq("user_id", tok.user_id).ilike("name", project).maybeSingle();
      if (!proj) return json({ error: "Project not found" }, 404);

      const n = Math.min(Math.max(1, +amount), 100);
      const expires_at = days > 0 ? new Date(Date.now() + days * 86400e3).toISOString() : null;
      const rows = Array.from({ length: n }, () => ({
        project_id: proj.id, user_id: tok.user_id, key_value: generateKey(),
        expires_at, is_active: true, note: note || null,
      }));
      const { data, error } = await supabase.from("v2_keys").insert(rows).select("key_value, expires_at");
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, keys: data });
    }

    // GET /keys/check?key=X&hwid=Y
    if (path === "keys/check" && req.method === "GET") {
      const key = url.searchParams.get("key");
      const hwid = url.searchParams.get("hwid");
      if (!key) return json({ error: "key param required" }, 400);

      const { data: k } = await supabase.from("v2_keys")
        .select("*, v2_projects!inner(user_id)")
        .eq("key_value", key)
        .eq("v2_projects.user_id", tok.user_id)
        .maybeSingle();
      if (!k) return json({ valid: false, reason: "not_found" });
      if (!k.is_active) return json({ valid: false, reason: "revoked" });
      if (k.expires_at && new Date(k.expires_at) < new Date()) return json({ valid: false, reason: "expired" });

      // HWID lock
      if (hwid) {
        if (k.hwid && k.hwid !== hwid) return json({ valid: false, reason: "hwid_mismatch" });
        if (!k.hwid) {
          await supabase.from("v2_keys").update({ hwid, last_used_at: new Date().toISOString() }).eq("id", k.id);
        }
      }
      await supabase.from("v2_keys").update({
        last_used_at: new Date().toISOString(), uses_count: (k.uses_count || 0) + 1,
      }).eq("id", k.id);

      return json({ valid: true, expires_at: k.expires_at, hwid: hwid || k.hwid });
    }

    // DELETE /keys/revoke?key=X
    if (path === "keys/revoke" && req.method === "DELETE") {
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "key required" }, 400);
      const { data: k } = await supabase.from("v2_keys")
        .select("id, v2_projects!inner(user_id)")
        .eq("key_value", key).eq("v2_projects.user_id", tok.user_id).maybeSingle();
      if (!k) return json({ error: "not found" }, 404);
      await supabase.from("v2_keys").update({ is_active: false }).eq("id", k.id);
      return json({ success: true });
    }

    // POST /keys/reset?key=X
    if (path === "keys/reset" && req.method === "POST") {
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "key required" }, 400);
      const { data: k } = await supabase.from("v2_keys")
        .select("id, hwid, reset_count, v2_projects!inner(user_id)")
        .eq("key_value", key).eq("v2_projects.user_id", tok.user_id).maybeSingle();
      if (!k) return json({ error: "not found" }, 404);
      await supabase.from("v2_key_resets").insert({ key_id: k.id, user_id: tok.user_id, old_hwid: k.hwid, reset_by: "api" });
      await supabase.from("v2_keys").update({ hwid: null, reset_count: (k.reset_count || 0) + 1 }).eq("id", k.id);
      return json({ success: true });
    }

    return json({ error: "Unknown route", path }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
