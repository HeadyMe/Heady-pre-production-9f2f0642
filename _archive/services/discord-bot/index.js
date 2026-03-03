/**
 * ═══ Heady Discord Bot — Service Group AI Gateway ═══
 *
 * Routes Discord slash commands to the Heady Intelligence Layer.
 * Each /heady command maps to a service group (swarm, code, battle, etc.)
 * and processes through the HeadyBrain API.
 *
 * Setup:
 *   1. Create a bot at https://discord.com/developers/applications
 *   2. Set DISCORD_BOT_TOKEN in .env
 *   3. Set DISCORD_CLIENT_ID in .env
 *   4. Run: node deploy-commands.js  (registers slash commands)
 *   5. Run: node index.js            (starts the bot)
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const HEADY_API = process.env.HEADY_URL || "http://127.0.0.1:3301";

if (!TOKEN) {
    console.log(`
╔═══════════════════════════════════════════════╗
║  🐝 Heady Discord Bot — Setup Required        ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  1. Create a bot at discord.com/developers    ║
║  2. Add to your .env:                         ║
║     DISCORD_BOT_TOKEN=your_token_here         ║
║     DISCORD_CLIENT_ID=your_client_id          ║
║  3. Run: node deploy-commands.js              ║
║  4. Run: node index.js                        ║
║                                               ║
╚═══════════════════════════════════════════════╝
`);
    process.exit(0);
}

// ── Service Group Config ──
const GROUPS = {
    swarm: { emoji: "🐝", color: 0xFEE75C, name: "HeadySwarm", tag: "[SWARM TASK]" },
    code: { emoji: "⚡", color: 0x57F287, name: "HeadyCoder", tag: "[CODE TASK]" },
    battle: { emoji: "⚔️", color: 0xED4245, name: "HeadyBattle", tag: "[BATTLE]" },
    creative: { emoji: "🎨", color: 0xEB459E, name: "HeadyCreative", tag: "[CREATIVE]" },
    simulate: { emoji: "🎲", color: 0x5865F2, name: "HeadySims", tag: "[SIMULATION]" },
    audit: { emoji: "📋", color: 0xF0B232, name: "HeadyGovernance", tag: "[AUDIT]" },
    brain: { emoji: "🧠", color: 0x9B59B6, name: "HeadyBrain", tag: "[INTELLIGENCE]" },
    lens: { emoji: "🔍", color: 0x3498DB, name: "HeadyLens", tag: "[VISION]" },
    decompose: { emoji: "🔀", color: 0x1ABC9C, name: "HeadyDecomp", tag: "[DECOMPOSE]" },
};

// ── Heady API Call ──
async function callHeady(message, group) {
    const tag = GROUPS[group]?.tag || "";
    const body = JSON.stringify({ message: `${tag} ${message}`, model: "auto" });

    const res = await fetch(`${HEADY_API}/api/brain/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return data.response || data.text || data.message || JSON.stringify(data);
}

async function getHealth() {
    try {
        const res = await fetch(`${HEADY_API}/api/pulse`, { signal: AbortSignal.timeout(5000) });
        return await res.json();
    } catch { return null; }
}

// ── Bot Client ──
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
    console.log(`🐝 Heady Discord Bot online as ${client.user.tag}`);
    console.log(`   Serving ${Object.keys(GROUPS).length} service groups`);
    console.log(`   API: ${HEADY_API}`);
    client.user.setActivity("/heady brain \"ask anything\"", { type: 3 });
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // ── /heady <group> <task> ──
    if (interaction.commandName === "heady") {
        const group = interaction.options.getString("group");
        const task = interaction.options.getString("task");
        const cfg = GROUPS[group] || GROUPS.brain;

        await interaction.deferReply();

        try {
            const start = Date.now();
            const response = await callHeady(task, group);
            const latency = Date.now() - start;

            // Truncate for Discord embed limits
            const text = response.length > 4000 ? response.substring(0, 3990) + "\n..." : response;

            const embed = new EmbedBuilder()
                .setColor(cfg.color)
                .setAuthor({ name: `${cfg.emoji} ${cfg.name}`, iconURL: client.user.displayAvatarURL() })
                .setDescription(text)
                .addFields(
                    { name: "Service Group", value: `\`${group}\``, inline: true },
                    { name: "Latency", value: `\`${latency}ms\``, inline: true },
                )
                .setFooter({ text: "Heady Intelligence Layer" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("⚠️ Service Error")
                .setDescription(`Failed to reach **${cfg.name}**:\n\`\`\`${err.message}\`\`\``)
                .setFooter({ text: "Check that HeadyManager is running" });
            await interaction.editReply({ embeds: [errEmbed] });
        }
    }

    // ── /heady-status ──
    if (interaction.commandName === "heady-status") {
        await interaction.deferReply();
        const health = await getHealth();
        const embed = new EmbedBuilder()
            .setColor(health ? 0x57F287 : 0xED4245)
            .setTitle("🐝 Heady System Status")
            .setDescription(health ? "All systems operational" : "⚠️ HeadyManager unreachable")
            .addFields(
                { name: "API", value: `\`${HEADY_API}\``, inline: true },
                { name: "Status", value: health ? "🟢 Online" : "🔴 Offline", inline: true },
                { name: "Service Groups", value: `\`${Object.keys(GROUPS).length}\``, inline: true },
            )
            .setTimestamp();
        if (health) {
            embed.addFields(
                { name: "Uptime", value: `\`${Math.round((health.uptime || 0) / 3600)}h\``, inline: true },
                { name: "Memory", value: `\`${Math.round((health.memory?.heapUsed || 0) / 1024 / 1024)}MB\``, inline: true },
            );
        }
        await interaction.editReply({ embeds: [embed] });
    }

    // ── /heady-services ──
    if (interaction.commandName === "heady-services") {
        const lines = Object.entries(GROUPS).map(([key, cfg]) =>
            `${cfg.emoji} **${cfg.name}** — \`/heady group:${key} task:"..."\``
        ).join("\n");

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("🐝 Heady Service Groups")
            .setDescription(`Use \`/heady\` with any of these groups:\n\n${lines}`)
            .setFooter({ text: `${Object.keys(GROUPS).length} service groups available` })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    }
});

client.login(TOKEN);
