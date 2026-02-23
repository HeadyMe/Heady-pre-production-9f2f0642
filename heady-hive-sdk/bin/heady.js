#!/usr/bin/env node
/**
 * Heady CLI — Command-line interface for the Heady Hive SDK
 * Usage: heady <command> [args]
 */

const { HeadyClient, OpenAIBridge, GCloudBridge } = require("../index");

const args = process.argv.slice(2);
const cmd = args[0];
const rest = args.slice(1).join(" ");

const heady = new HeadyClient({
    url: process.env.HEADY_URL || "http://localhost:3301",
    apiKey: process.env.HEADY_API_KEY || "",
});

const COMMANDS = {
    async chat() {
        if (!rest) return console.log("Usage: heady chat \"message\"");
        const res = await heady.brain.chat(rest);
        console.log(res.response || res.text || JSON.stringify(res, null, 2));
    },

    async analyze() {
        if (!rest) return console.log("Usage: heady analyze \"content\"");
        const res = await heady.brain.analyze(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    async health() {
        const info = await heady.info();
        console.log("🧠 Heady System Info");
        console.log(`   Connected: ${info.connected}`);
        console.log(`   SDK: v${info.sdk.version}`);
        console.log(`   URL: ${info.sdk.url}`);
        if (info.autoSuccess) {
            const as = info.autoSuccess;
            console.log(`   Engine: ${as.running ? "RUNNING" : "STOPPED"}`);
            console.log(`   Tasks: ${as.totalTasks}`);
            console.log(`   Cycles: ${as.cycleCount}`);
            console.log(`   Success Rate: ${as.successRate}`);
        }
    },

    async status() {
        const res = await heady.autoSuccess();
        console.log("⚡ Auto-Success Status");
        console.log(JSON.stringify(res, null, 2));
    },

    async battle() {
        if (!rest) return console.log("Usage: heady battle \"change description\"");
        const res = await heady.battle.validate(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    async creative() {
        if (!rest) return console.log("Usage: heady creative \"prompt\"");
        const res = await heady.creative.generate(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    async search() {
        if (!rest) return console.log("Usage: heady search \"query\"");
        const res = await heady.brain.search(rest);
        console.log(JSON.stringify(res, null, 2));
    },

    async mcp() {
        const tools = await heady.mcp.listTools();
        console.log("🔧 MCP Tools:");
        if (Array.isArray(tools)) tools.forEach(t => console.log(`   ${t.name} — ${t.description?.substring(0, 60)}`));
        else console.log(JSON.stringify(tools, null, 2));
    },

    async openai() {
        const bridge = new OpenAIBridge();
        const h = await bridge.health();
        console.log("🤖 OpenAI Bridge:", JSON.stringify(h));
    },

    async gcloud() {
        const bridge = new GCloudBridge();
        const h = await bridge.health();
        console.log("☁️  Google Cloud:", JSON.stringify(h));
    },

    help() {
        console.log(`
🐝 Heady Hive SDK CLI — v${require("../package.json").version}

Commands:
  heady chat "message"      Chat with HeadyBrain
  heady analyze "content"   Analyze code/text
  heady search "query"      Search knowledge base
  heady battle "change"     Validate a change through HeadyBattle
  heady creative "prompt"   Generate creative content
  heady health              System health check
  heady status              Auto-success engine status
  heady mcp                 List MCP tools
  heady openai              OpenAI bridge health
  heady gcloud              Google Cloud bridge health
  heady help                This help

Environment:
  HEADY_URL         Heady Manager URL (default: http://localhost:3301)
  HEADY_API_KEY     API authentication key
  OPENAI_API_KEY    OpenAI API key (for bridge)
  GCLOUD_API_KEY    Google Cloud API key (for bridge)
`);
    },
};

(async () => {
    try {
        if (!cmd || cmd === "help" || cmd === "--help") return COMMANDS.help();
        if (!COMMANDS[cmd]) return console.log(`Unknown command: ${cmd}. Run 'heady help' for usage.`);
        await COMMANDS[cmd]();
    } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
    }
})();
