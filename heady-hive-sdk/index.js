/**
 * Heady Hive SDK — Official client library for the Heady AI ecosystem
 * 
 * Connect to Brain, Battle, Creative, MCP, and 40+ services through a
 * unified, zero-dependency SDK.
 * 
 * Usage:
 *   const { HeadyClient } = require("heady-hive-sdk");
 *   const heady = new HeadyClient({ url: "https://headyme.com", apiKey: "..." });
 *   const reply = await heady.brain.chat("Hello!");
 */

const HeadyClient = require("./lib/client");
const HeadyBrain = require("./lib/brain");
const HeadyBattle = require("./lib/battle");
const HeadyCreative = require("./lib/creative");
const HeadyMCP = require("./lib/mcp");
const HeadyAuth = require("./lib/auth");
const HeadyEvents = require("./lib/events");
const OpenAIBridge = require("./lib/openai-bridge");
const GCloudBridge = require("./lib/gcloud-bridge");

module.exports = {
    HeadyClient,
    HeadyBrain,
    HeadyBattle,
    HeadyCreative,
    HeadyMCP,
    HeadyAuth,
    HeadyEvents,
    OpenAIBridge,
    GCloudBridge,
    version: require("./package.json").version,
};
