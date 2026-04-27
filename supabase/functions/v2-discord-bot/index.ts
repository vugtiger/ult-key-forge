// Nebula Discord bot — interaction handler (Luarmor-parity)
import { createClient } from "npm:@supabase/supabase-js@2";

const PUBLIC_KEY = Deno.env.get("V2_DISCORD_PUBLIC_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 };
const InteractionResponseType = { PONG: 1, CHANNEL_MESSAGE_WITH_SOURCE: 4 };
const FLAG_EPHEMERAL = 64;

async function verifyRequest(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get("X-Signature-Ed25519");
  const timestamp = req.headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp) return false;
  try {
    const message = new TextEncoder().encode(timestamp + body);
    const keyData = new Uint8Array(PUBLIC_KEY.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const sigData = new Uint8Array(signature.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const key = await crypto.subtle.importKey("raw", keyData, { name: "Ed25519", namedCurve: "Ed25519" } as any, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, sigData, message);
  } catch { return false; }
}

const reply = (content: string, ephemeral = true) => new Response(JSON.stringify({
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: { content, flags: ephemeral ? FLAG_EPHEMERAL : 0 },
}), { headers: { "Content-Type": "application/json" } });

const embedReply = (embed: any, ephemeral = true) => new Response(JSON.stringify({
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: { embeds: [embed], flags: ephemeral ? FLAG_EPHEMERAL : 0 },
}), { headers: { "Content-Type": "application/json" } });

const opt = (opts: any[] | undefined, name: string) => opts?.find(o => o.name === name)?.value;

const getLinkedUser = async (discordId: string) => {
  const { data } = await supabase.from("v2_profiles").select("*").eq("discord_id", discordId).maybeSingle();
  return data;
};
const findProject = async (userId: string, name: string) => {
  const { data } = await supabase.from("v2_projects").select("*").eq("user_id", userId).ilike("name", name).maybeSingle();
  return data;
};
const findKey = async (userId: string, key: string) => {
  const { data } = await supabase.from("v2_keys").select("*, v2_projects!inner(name, user_id)")
    .eq("key_value", key).eq("v2_projects.user_id", userId).maybeSingle();
  return data;
};

function generateKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `NBL-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 14)}`;
}

async function dmUser(discordId: string, content: string) {
  const TOKEN = Deno.env.get("V2_DISCORD_BOT_TOKEN");
  try {
    const ch = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: discordId }),
    }).then(r => r.json());
    await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    return true;
  } catch (e) { console.error("DM failed", e); return false; }
}

async function handleCommand(name: string, options: any[], discordId: string, discordUsername: string, resolved: any) {
  if (name === "ping") return reply("🪐 Pong! Nebula online.");

  if (name === "help") {
    return embedReply({
      title: "Nebula — Discord Bot",
      color: 0xffffff,
      description: "Manage your script protection from Discord.",
      fields: [
        { name: "👤 Account", value: "`/link` `/unlink` `/me`" },
        { name: "📁 Projects", value: "`/projects` `/newproject` `/delproject`" },
        { name: "🔑 Keys", value: "`/keygen` `/keys` `/keyinfo` `/revoke` `/unrevoke` `/resethwid` `/extend` `/transfer` `/whitelist`" },
        { name: "🚫 Moderation", value: "`/blacklist` `/unblacklist`" },
        { name: "📊 Insight", value: "`/stats` `/execstats` `/userlookup`" },
        { name: "👥 Resellers", value: "`/addreseller` `/removereseller`" },
        { name: "⚡ API", value: "`/apitoken`" },
      ],
      footer: { text: "Get started: dashboard /v2/settings → generate link code" },
    });
  }

  // ---- Account
  if (name === "link") {
    const code = String(opt(options, "code") || "").trim();
    if (!/^\d{6}$/.test(code)) return reply("❌ Invalid code format.");
    const { data: link } = await supabase.from("v2_discord_link_codes")
      .select("*").eq("code", code).eq("used", false)
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!link) return reply("❌ Code invalid, expired, or already used.");
    if (await getLinkedUser(discordId)) return reply("❌ Already linked. `/unlink` first.");
    await supabase.from("v2_profiles").update({ discord_id: discordId, discord_username: discordUsername }).eq("id", link.user_id);
    await supabase.from("v2_discord_link_codes").update({ used: true }).eq("id", link.id);
    return reply("✅ Account linked! Try `/me`.");
  }
  if (name === "unlink") {
    const u = await getLinkedUser(discordId);
    if (!u) return reply("❌ Not linked.");
    await supabase.from("v2_profiles").update({ discord_id: null, discord_username: null }).eq("id", u.id);
    return reply("✅ Unlinked.");
  }
  if (name === "me") {
    const u = await getLinkedUser(discordId);
    if (!u) return reply("❌ Not linked. Use `/link <code>`.");
    return embedReply({
      title: u.display_name || "Nebula account", color: 0xffffff,
      fields: [
        { name: "Plan", value: u.plan, inline: true },
        { name: "User ID", value: `\`${u.id.slice(0, 8)}\``, inline: true },
      ],
    });
  }

  // From here, all require linked
  const user = await getLinkedUser(discordId);
  if (!user) return reply("❌ Not linked. Use `/link <code>` (generate at /v2/settings).");

  // ---- Projects
  if (name === "projects") {
    const { data } = await supabase.from("v2_projects").select("name, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    if (!data?.length) return reply("📁 No projects. Use `/newproject name:<name>`.");
    return embedReply({ title: "Your projects", color: 0xffffff, description: data.map((p, i) => `**${i + 1}.** ${p.name}`).join("\n") });
  }
  if (name === "newproject") {
    const n = String(opt(options, "name") || "").trim();
    if (!n) return reply("❌ Name required.");
    const { error } = await supabase.from("v2_projects").insert({ user_id: user.id, name: n });
    if (error) return reply("❌ " + error.message);
    return reply(`✅ Project **${n}** created.`);
  }
  if (name === "delproject") {
    const p = await findProject(user.id, String(opt(options, "name") || ""));
    if (!p) return reply("❌ Not found.");
    await supabase.from("v2_projects").delete().eq("id", p.id);
    return reply(`🗑️ Deleted **${p.name}**.`);
  }

  // ---- Keys
  if (name === "keygen") {
    const project = await findProject(user.id, String(opt(options, "project") || ""));
    if (!project) return reply("❌ Project not found.");
    const amount = Math.min(100, Math.max(1, +(opt(options, "amount") || 1)));
    const days = +(opt(options, "days") ?? 30);
    const note = opt(options, "note") || null;
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400e3).toISOString() : null;
    const rows = Array.from({ length: amount }, () => ({
      project_id: project.id, user_id: user.id, key_value: generateKey(), expires_at, is_active: true, note,
    }));
    await supabase.from("v2_keys").insert(rows);
    const list = rows.map(r => `\`${r.key_value}\``).join("\n");
    return reply(`✅ Generated ${amount} key${amount > 1 ? "s" : ""} for **${project.name}** (${days > 0 ? days + "d" : "permanent"}):\n${list}`);
  }
  if (name === "keys") {
    const project = await findProject(user.id, String(opt(options, "project") || ""));
    if (!project) return reply("❌ Project not found.");
    const { data } = await supabase.from("v2_keys").select("key_value, is_active, expires_at, hwid")
      .eq("project_id", project.id).order("created_at", { ascending: false }).limit(15);
    if (!data?.length) return reply(`📭 No keys in **${project.name}**.`);
    const lines = data.map(k => {
      const expired = k.expires_at && new Date(k.expires_at) < new Date();
      const s = expired ? "⏱️" : k.is_active ? "✅" : "🚫";
      return `${s} \`${k.key_value}\`${k.hwid ? " 🔒" : ""}`;
    }).join("\n");
    return embedReply({ title: `Keys — ${project.name}`, color: 0xffffff, description: lines });
  }
  if (name === "keyinfo") {
    const k = await findKey(user.id, String(opt(options, "key") || "").trim());
    if (!k) return reply("❌ Key not found.");
    return embedReply({
      title: `Key ${k.key_value}`, color: 0xffffff,
      fields: [
        { name: "Project", value: (k as any).v2_projects?.name, inline: true },
        { name: "Status", value: k.is_active ? "Active" : "Revoked", inline: true },
        { name: "HWID", value: k.hwid ? `\`${k.hwid.slice(0, 12)}...\`` : "Not locked", inline: true },
        { name: "Uses", value: String(k.uses_count || 0), inline: true },
        { name: "Resets", value: String(k.reset_count || 0), inline: true },
        { name: "Expires", value: k.expires_at ? new Date(k.expires_at).toLocaleString() : "Never", inline: true },
        ...(k.note ? [{ name: "Note", value: k.note }] : []),
      ],
    });
  }
  if (name === "revoke") {
    const k = await findKey(user.id, String(opt(options, "key") || "").trim());
    if (!k) return reply("❌ Not found.");
    await supabase.from("v2_keys").update({ is_active: false }).eq("id", k.id);
    return reply(`🚫 Revoked \`${k.key_value}\`.`);
  }
  if (name === "unrevoke") {
    const k = await findKey(user.id, String(opt(options, "key") || "").trim());
    if (!k) return reply("❌ Not found.");
    await supabase.from("v2_keys").update({ is_active: true }).eq("id", k.id);
    return reply(`✅ Reactivated \`${k.key_value}\`.`);
  }
  if (name === "resethwid") {
    const k = await findKey(user.id, String(opt(options, "key") || "").trim());
    if (!k) return reply("❌ Not found.");
    await supabase.from("v2_key_resets").insert({ key_id: k.id, user_id: user.id, old_hwid: k.hwid, reset_by: "discord" });
    await supabase.from("v2_keys").update({ hwid: null, reset_count: (k.reset_count || 0) + 1 }).eq("id", k.id);
    return reply(`🔓 HWID reset for \`${k.key_value}\`.`);
  }
  if (name === "extend") {
    const k = await findKey(user.id, String(opt(options, "key") || "").trim());
    if (!k) return reply("❌ Not found.");
    const days = +(opt(options, "days") || 0);
    const base = k.expires_at && new Date(k.expires_at) > new Date() ? new Date(k.expires_at) : new Date();
    const newExp = new Date(base.getTime() + days * 86400e3).toISOString();
    await supabase.from("v2_keys").update({ expires_at: newExp }).eq("id", k.id);
    return reply(`⏰ Extended \`${k.key_value}\` by ${days}d → ${new Date(newExp).toLocaleDateString()}.`);
  }
  if (name === "transfer") {
    const k = await findKey(user.id, String(opt(options, "key") || "").trim());
    if (!k) return reply("❌ Not found.");
    const newhwid = String(opt(options, "newhwid") || "").trim();
    await supabase.from("v2_keys").update({ hwid: newhwid }).eq("id", k.id);
    return reply(`📤 Transferred \`${k.key_value}\` to new HWID.`);
  }
  if (name === "whitelist") {
    const project = await findProject(user.id, String(opt(options, "project") || ""));
    if (!project) return reply("❌ Project not found.");
    const targetUser = opt(options, "user");
    const targetData = resolved?.users?.[targetUser];
    const days = +(opt(options, "days") ?? 30);
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400e3).toISOString() : null;
    const key = generateKey();
    await supabase.from("v2_keys").insert({
      project_id: project.id, user_id: user.id, key_value: key, expires_at,
      is_active: true, discord_id: targetUser, note: `Whitelisted ${targetData?.username || targetUser}`,
    });
    await dmUser(targetUser, `🎁 You've been whitelisted in **${project.name}** by <@${discordId}>!\n\nYour key: \`${key}\`${expires_at ? `\nExpires: <t:${Math.floor(new Date(expires_at).getTime()/1000)}:R>` : "\n(permanent)"}`);
    return reply(`✅ Whitelisted <@${targetUser}> with key \`${key}\` (DM sent).`);
  }

  // ---- Moderation
  if (name === "blacklist") {
    const project = await findProject(user.id, String(opt(options, "project") || ""));
    if (!project) return reply("❌ Project not found.");
    const { error } = await supabase.from("v2_blacklist").insert({
      project_id: project.id, user_id: user.id,
      entry_type: String(opt(options, "type")), entry_value: String(opt(options, "value")),
      reason: opt(options, "reason") || null,
    });
    if (error) return reply("❌ " + error.message);
    return reply(`🚫 Blacklisted in **${project.name}**.`);
  }
  if (name === "unblacklist") {
    const project = await findProject(user.id, String(opt(options, "project") || ""));
    if (!project) return reply("❌ Project not found.");
    const { error } = await supabase.from("v2_blacklist").delete()
      .eq("project_id", project.id).eq("entry_value", String(opt(options, "value")));
    if (error) return reply("❌ " + error.message);
    return reply(`✅ Removed from blacklist in **${project.name}**.`);
  }

  // ---- Stats
  if (name === "stats") {
    const project = await findProject(user.id, String(opt(options, "project") || ""));
    if (!project) return reply("❌ Project not found.");
    const [{ count: scripts }, { count: keys }, { count: activeKeys }, { count: logs }, { count: bl }] = await Promise.all([
      supabase.from("v2_scripts").select("*", { count: "exact", head: true }).eq("project_id", project.id),
      supabase.from("v2_keys").select("*", { count: "exact", head: true }).eq("project_id", project.id),
      supabase.from("v2_keys").select("*", { count: "exact", head: true }).eq("project_id", project.id).eq("is_active", true),
      supabase.from("v2_logs").select("*", { count: "exact", head: true }).eq("project_id", project.id),
      supabase.from("v2_blacklist").select("*", { count: "exact", head: true }).eq("project_id", project.id),
    ]);
    return embedReply({
      title: `📊 ${project.name}`, color: 0xffffff,
      fields: [
        { name: "Scripts", value: String(scripts || 0), inline: true },
        { name: "Keys", value: `${activeKeys || 0} / ${keys || 0}`, inline: true },
        { name: "Logs", value: String(logs || 0), inline: true },
        { name: "Blacklist", value: String(bl || 0), inline: true },
      ],
    });
  }
  if (name === "execstats") {
    const project = await findProject(user.id, String(opt(options, "project") || ""));
    if (!project) return reply("❌ Project not found.");
    const since = new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
    const { data } = await supabase.from("v2_exec_stats").select("day, exec_count, unique_users")
      .eq("project_id", project.id).gte("day", since).order("day");
    if (!data?.length) return reply(`📈 No exec data yet for **${project.name}**.`);
    const lines = data.map((d: any) => `\`${d.day}\` — ${d.exec_count} execs · ${d.unique_users} users`).join("\n");
    return embedReply({ title: `📈 ${project.name} — last 7 days`, color: 0xffffff, description: lines });
  }
  if (name === "userlookup") {
    const q = String(opt(options, "query") || "").trim();
    const { data: byKey } = await supabase.from("v2_keys").select("*, v2_projects!inner(name, user_id)")
      .or(`key_value.eq.${q},hwid.eq.${q},discord_id.eq.${q}`).eq("v2_projects.user_id", user.id).limit(5);
    if (!byKey?.length) return reply("🔍 No matches.");
    const lines = byKey.map((k: any) => `\`${k.key_value}\` · ${k.v2_projects.name} · ${k.is_active ? "✅" : "🚫"}${k.hwid ? " 🔒" : ""}`).join("\n");
    return embedReply({ title: `🔍 Matches for "${q}"`, color: 0xffffff, description: lines });
  }

  // ---- Resellers
  if (name === "addreseller") {
    const targetDiscord = opt(options, "user");
    const project = await findProject(user.id, String(opt(options, "project") || ""));
    if (!project) return reply("❌ Project not found.");
    const { data: target } = await supabase.from("v2_profiles").select("id").eq("discord_id", targetDiscord).maybeSingle();
    if (!target) return reply("❌ User not linked to Nebula.");
    const { error } = await supabase.from("v2_resellers").insert({
      owner_id: user.id, reseller_user_id: target.id, project_id: project.id,
    });
    if (error) return reply("❌ " + error.message);
    return reply(`👥 <@${targetDiscord}> added as reseller for **${project.name}**.`);
  }
  if (name === "removereseller") {
    const targetDiscord = opt(options, "user");
    const { data: target } = await supabase.from("v2_profiles").select("id").eq("discord_id", targetDiscord).maybeSingle();
    if (!target) return reply("❌ Not linked.");
    await supabase.from("v2_resellers").delete().eq("owner_id", user.id).eq("reseller_user_id", target.id);
    return reply(`👋 Removed <@${targetDiscord}> as reseller.`);
  }

  // ---- API
  if (name === "apitoken") {
    const tokName = String(opt(options, "name") || "").trim() || "discord-generated";
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = "NBL_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    await supabase.from("v2_api_tokens").insert({ user_id: user.id, name: tokName, token });
    const sent = await dmUser(discordId, `🔐 Your new Nebula API token (**${tokName}**):\n\`\`\`\n${token}\n\`\`\`\nKeep it safe — it grants full API access.`);
    return reply(sent ? "📬 Token sent via DM." : "⚠️ Couldn't DM you. Enable DMs and try again.");
  }

  return reply("❌ Unknown command.");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });
  const body = await req.text();
  if (!await verifyRequest(req, body)) return new Response("Invalid signature", { status: 401 });
  const interaction = JSON.parse(body);
  if (interaction.type === InteractionType.PING) {
    return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), { headers: { "Content-Type": "application/json" } });
  }
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const u = interaction.member?.user || interaction.user;
    try {
      return await handleCommand(interaction.data.name, interaction.data.options, u.id, u.username, interaction.data.resolved);
    } catch (e: any) {
      console.error("Command error:", e);
      return reply("❌ Error: " + (e?.message || "unknown"));
    }
  }
  return new Response("OK", { status: 200 });
});
