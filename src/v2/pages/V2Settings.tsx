import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "../components/V2Layout";
import { v2SignOut } from "../lib/v2Auth";
import { useNavigate } from "react-router-dom";
import { Save, Trash2, Link as LinkIcon, Copy, Check } from "lucide-react";

const V2Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("v2_profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(data);
      setDisplayName(data?.display_name || "");
    });
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from("v2_profiles").update({ display_name: displayName }).eq("id", profile.id);
    setSaving(false);
  };

  const generateLinkCode = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
    await supabase.from("v2_discord_link_codes").insert({ user_id: user.id, code });
    setLinkCode(code);
  };

  const unlinkDiscord = async () => {
    if (!confirm("Unlink your Discord account?")) return;
    await supabase.from("v2_profiles").update({ discord_id: null, discord_username: null }).eq("id", profile.id);
    setProfile({ ...profile, discord_id: null, discord_username: null });
  };

  const copyCode = () => { if (!linkCode) return; navigator.clipboard.writeText(linkCode); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const deleteAccount = async () => {
    if (!confirm("DELETE YOUR ACCOUNT? This wipes everything. There is no undo.")) return;
    if (!confirm("Are you really sure? Type-confirmed below would be safer but… last chance.")) return;
    // Cascading deletes via RLS — wipe profile (FK cascade handles the rest of v2_*)
    await supabase.from("v2_projects").delete().eq("user_id", profile.id);
    await supabase.from("v2_profiles").delete().eq("id", profile.id);
    await v2SignOut();
    navigate("/v2");
  };

  return (
    <V2Layout title="Settings" subtitle="Account, Discord linking, danger zone">
      <div className="max-w-2xl space-y-4">
        {/* Profile */}
        <div className="v2-card p-6">
          <h3 className="font-semibold mb-4">Profile</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs block mb-1.5 text-white/60 font-medium">Display name</label>
              <input className="v2-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs block mb-1.5 text-white/60 font-medium">Plan</label>
              <div><span className="v2-badge v2-badge-success">{profile?.plan || "free"}</span></div>
            </div>
            <button onClick={save} disabled={saving} className="v2-btn v2-btn-primary"><Save size={14} /> {saving ? "Saving…" : "Save"}</button>
          </div>
        </div>

        {/* Discord */}
        <div className="v2-card p-6">
          <h3 className="font-semibold mb-1">Discord linking</h3>
          <p className="text-sm text-white/50 mb-4">Link your Discord to use the v2 bot commands like /keygen and /panel.</p>

          {profile?.discord_id ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div>
                <div className="text-sm font-medium">Linked: {profile.discord_username || profile.discord_id}</div>
                <div className="v2-mono text-[11px] text-white/45">{profile.discord_id}</div>
              </div>
              <button onClick={unlinkDiscord} className="v2-btn v2-btn-danger text-xs">Unlink</button>
            </div>
          ) : linkCode ? (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
                <div className="text-xs text-white/45 mb-1">Run this in any Discord server with the v2 bot:</div>
                <div className="v2-mono text-lg font-bold tracking-widest">/link {linkCode}</div>
              </div>
              <button onClick={copyCode} className="v2-btn v2-btn-secondary w-full">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : `Copy code: ${linkCode}`}
              </button>
              <p className="text-xs text-white/45 text-center">Code expires in 10 minutes.</p>
            </div>
          ) : (
            <button onClick={generateLinkCode} className="v2-btn v2-btn-primary"><LinkIcon size={14} /> Generate link code</button>
          )}
        </div>

        {/* Danger */}
        <div className="v2-card p-6 border-red-500/20">
          <h3 className="font-semibold mb-1 text-red-400">Danger zone</h3>
          <p className="text-sm text-white/50 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
          <button onClick={deleteAccount} className="v2-btn v2-btn-danger"><Trash2 size={14} /> Delete account</button>
        </div>
      </div>
    </V2Layout>
  );
};

export default V2Settings;
