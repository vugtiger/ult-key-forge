// v2 Discord bot — interaction handler
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import nacl from "npm:tweetnacl@1.0.3";

const PUBLIC_KEY = Deno.env.get("V2_DISCORD_PUBLIC_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 };
const InteractionResponseType = { PONG: 1, CHANNEL_MESSAGE_WITH_SOURCE: 4 };
const FLAG_EPHEMERAL = 64;

function hexToBytes(hex: string) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a;
}

function reply(content: string, ephemeral = true) {
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: ephemeral ? FLAG_EPHEMERAL : 0 },
  }), { headers: { "Content-Type": "application/json" } });
}

function embedReply(embed: any, ephemeral = true) {
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { embeds: [embed], flags: ephemeral ? FLAG_EPHEMERAL : 0 },
  }), { headers: { "Content-Type": "application/json" } });
}

const opt = (opts: any[] | undefined, name: string) => opts?.find((o) => o.name === name)?.value;

async function getLinkedUser(discordId: string) {
  const { data } = await supabase.from("v2_profiles").select("*").eq("discord_id", discordId).maybeSingle();
  return data;
}

async function findProject(userId: string, name: string) {
  const { data } = await supabase.from("v2_projects").select("*").eq("user_id", userId).ilike("name", name).maybeSingle();
  return data;
}

function generateKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `PHX-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 14)}`;
}

async function handleCommand(name: string, options: any[], discordId: string, discordUsername: string) {
  if (name === "ping") return reply("🏓 Pong! v2 bot is alive.");

  if (name === "help") {
    return embedReply({
      title: "Phantom v2 — Bot Commands",
      color: 0xffffff,
      description: "Manage your v2 protection from Discord.",
      fields: [
        { name: "Account", value: "`/link <code>` `/unlink` `/me`", inline: false },
        { name: "Projects", value: "`/projects` `/newproject`", inline: false },
        { name: "Keys", value: "`/keygen` `/keys` `/revoke`", inline: false },
        { name: "Moderation", value: "`/blacklist`", inline: false },
        { name: "Insight", value: "`/stats`", inline: false },
      ],
      footer: { text: "Get started: visit your dashboard /v2/settings → Generate link code" },
    });
  }

  if (name === "link") {
    const code = String(opt(options, "code") || "").trim();
    if (!/^\d{6}$/.test(code)) return reply("❌ Invalid code. Generate a 6-digit code at /v2/settings.");

    const { data: link } = await supabase
      .from("v2_discord_link_codes")
      .select("*").eq("code", code).eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!link) return reply("❌ Code invalid, expired, or already used.");

    // Check if discord already linked elsewhere
    const existing = await getLinkedUser(discordId);
    if (existing) return reply(`❌ Your Discord is already linked to a v2 account. Use \`/unlink\` first.`);

    await supabase.from("v2_profiles").update({
      discord_id: discordId, discord_username: discordUsername,
    }).eq("id", link.user_id);
    await supabase.from("v2_discord_link_codes").update({ used: true }).eq("id", link.id);

    return reply("✅ Account linked! Try `/me` or `/projects`.");
  }

  if (name === "unlink") {
    const u = await getLinkedUser(discordId);
    if (!u) return reply("❌ Your Discord isn't linked.");
    await supabase.from("v2_profiles").update({ discord_id: null, discord_username: null }).eq("id", u.id);
    return reply("✅ Unlinked.");
  }

  if (name === "me") {
    const u = await getLinkedUser(discordId);
    if (!u) return reply("❌ Not linked. Use `/link <code>` first.");
    return embedReply({
      title: u.display_name || "v2 Account",
      color: 0xffffff,
      fields: [
        { name: "Plan", value: u.plan, inline: true },
        { name: "Linked since", value: new Date(u.updated_at).toLocaleDateString(), inline: true },
      ],
    });
  }

  // Everything below requires linked account
  const user = await getLinkedUser(discordId);
  if (!user) return reply("❌ Not linked. Use `/link <code>` first (generate at /v2/settings).");

  if (name === "projects") {
    const { data } = await supabase.from("v2_projects").select("name, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    if (!data?.length) return reply("📁 No projects yet. Use `/newproject name:<name>`.");
    return embedReply({
      title: "Your projects", color: 0xffffff,
      description: data.map((p, i) => `**${i + 1}.** ${p.name}`).join("\n"),
    });
  }

  if (name === "newproject") {
    const n = String(opt(options, "name") || "").trim();
    if (!n) return reply("❌ Name required.");
    const { error } = await supabase.from("v2_projects").insert({ user_id: user.id, name: n });
    if (error) return reply("❌ " + error.message);
    return reply(`✅ Project **${n}** created.`);
  }

  if (name === "keygen") {
    const pname = String(opt(options, "project") || "");
    const amount = Number(opt(options, "amount") || 1);
    const days = Number(opt(options, "days") ?? 30);
    const project = await findProject(user.id, pname);
    if (!project) return reply(`❌ No project named "${pname}".`);
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400 * 1000).toISOString() : null;
    const rows = Array.from({ length: amount }, () => ({
      project_id: project.id, user_id: user.id, key_value: generateKey(), expires_at, is_active: true,
    }));
    await supabase.from("v2_keys").insert(rows);
    const keysList = rows.map(r => `\`${r.key_value}\``).join("\n");
    return reply(`✅ Generated ${amount} key${amount > 1 ? "s" : ""} for **${project.name}** (${days > 0 ? days + "d" : "permanent"}):\n${keysList}`);
  }

  if (name === "keys") {
    const pname = String(opt(options, "project") || "");
    const project = await findProject(user.id, pname);
    if (!project) return reply(`❌ No project named "${pname}".`);
    const { data } = await supabase.from("v2_keys").select("key_value, is_active, expires_at").eq("project_id", project.id).order("created_at", { ascending: false }).limit(15);
    if (!data?.length) return reply(`📭 No keys in **${project.name}**.`);
    const lines = data.map(k => {
      const expired = k.expires_at && new Date(k.expires_at) < new Date();
      const status = expired ? "⏱️" : k.is_active ? "✅" : "🚫";
      return `${status} \`${k.key_value}\``;
    }).join("\n");
    return embedReply({ title: `Recent keys — ${project.name}`, color: 0xffffff, description: lines });
  }

  if (name === "revoke") {
    const k = String(opt(options, "key") || "").trim();
    const { data } = await supabase.from("v2_keys").select("id, project_id").eq("key_value", k).eq("user_id", user.id).maybeSingle();
    if (!data) return reply("❌ Key not found in your account.");
    await supabase.from("v2_keys").delete().eq("id", data.id);
    return reply(`✅ Revoked \`${k}\`.`);
  }

  if (name === "blacklist") {
    const pname = String(opt(options, "project") || "");
    const type = String(opt(options, "type") || "");
    const value = String(opt(options, "value") || "");
    const reason = opt(options, "reason") ? String(opt(options, "reason")) : null;
    const project = await findProject(user.id, pname);
    if (!project) return reply(`❌ No project named "${pname}".`);
    const { error } = await supabase.from("v2_blacklist").insert({
      project_id: project.id, user_id: user.id, entry_type: type, entry_value: value, reason,
    });
    if (error) return reply("❌ " + error.message);
    return reply(`🚫 Blacklisted **${type}**: \`${value}\` in **${project.name}**`);
  }

  if (name === "stats") {
    const pname = String(opt(options, "project") || "");
    const project = await findProject(user.id, pname);
    if (!project) return reply(`❌ No project named "${pname}".`);
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

  return reply("❌ Unknown command.");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  const sig = req.headers.get("X-Signature-Ed25519");
  const ts = req.headers.get("X-Signature-Timestamp");
  const body = await req.text();
  if (!sig || !ts) return new Response("Missing signature", { status: 401 });

  const valid = nacl.sign.detached.verify(
    new TextEncoder().encode(ts + body),
    hexToBytes(sig),
    hexToBytes(PUBLIC_KEY),
  );
  if (!valid) return new Response("Invalid signature", { status: 401 });

  const interaction = JSON.parse(body);

  if (interaction.type === InteractionType.PING) {
    return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const name = interaction.data.name;
    const options = interaction.data.options;
    const user = interaction.member?.user || interaction.user;
    try {
      return await handleCommand(name, options, user.id, user.username);
    } catch (e: any) {
      console.error("Command error:", e);
      return reply("❌ Internal error: " + (e?.message || "unknown"));
    }
  }

  return new Response("OK", { status: 200 });
});
