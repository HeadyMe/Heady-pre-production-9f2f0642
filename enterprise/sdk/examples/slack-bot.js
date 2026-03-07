'use strict';

/**
 * @file slack-bot.js
 * @description Slack bot integration example using HeadyOS for AI responses.
 * Uses @slack/bolt for Slack platform integration and @heady-ai/sdk for AI.
 *
 * Features:
 * - Responds to @mentions in channels
 * - Responds to DMs
 * - Maintains conversation context in HeadyOS vector memory
 * - Streams AI responses via Slack's typing indicator
 * - Supports slash commands: /heady-ask, /heady-research
 *
 * Setup:
 * 1. Create a Slack App at api.slack.com/apps
 * 2. Enable Socket Mode
 * 3. Add Bot Token Scopes: app_mentions:read, channels:history, chat:write, im:write
 * 4. Set environment variables below
 *
 * @requires @slack/bolt
 * @requires @heady-ai/sdk
 */

const { App } = require('@slack/bolt');

// HeadyClient — loaded from published npm package
// const { HeadyClient } = require('@heady-ai/sdk');
// For local development from this repo:
const HeadyClient = {
  // Stub — replace with actual import
  brain: { chat: async () => ({ message: { content: 'HeadyOS response' } }) },
  memory: {
    store: async () => {},
    search: async () => ({ results: [] })
  },
  agents: { get: async () => null },
  conductor: { submitTask: async () => ({ taskId: 'task-001' }) },
};

// ---------------------------------------------------------------------------
// φ Constants
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

const BOT_CONSTANTS = {
  // Max conversation history to include in context: fib(5)=5 messages
  MAX_HISTORY_MESSAGES: fib(5),
  // Memory namespace for conversation context
  MEMORY_NAMESPACE: 'slack-bot-context',
  // Memory TTL: fib(11)=89 days
  MEMORY_TTL_DAYS: fib(11),
  // Min memory score for context retrieval: 1/φ² ≈ 0.382
  MEMORY_MIN_SCORE: 1 / (PHI * PHI),
  // Default temperature: 1/φ ≈ 0.618
  DEFAULT_TEMPERATURE: 1 / PHI,
  // Max response tokens: fib(10)=55 × 20 = 1100
  MAX_TOKENS: fib(10) * 20,
};

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

// Validate required environment variables
const required = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_SIGNING_SECRET', 'HEADY_API_KEY'];
for (const envVar of required) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize Slack Bolt app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
});

// Initialize HeadyOS client
// const heady = new HeadyClient({
//   apiKey: process.env.HEADY_API_KEY,
//   tenantId: process.env.HEADY_TENANT_ID,
// });
const heady = HeadyClient;

// ---------------------------------------------------------------------------
// Context Management
// ---------------------------------------------------------------------------

/**
 * Retrieve relevant conversation context from HeadyOS vector memory.
 */
const getConversationContext = async (userId, channelId, currentMessage) => {
  const namespace = `${BOT_CONSTANTS.MEMORY_NAMESPACE}:${channelId}:${userId}`;
  const results = await heady.memory.search(currentMessage, {
    namespace,
    topK: BOT_CONSTANTS.MAX_HISTORY_MESSAGES,
    minScore: BOT_CONSTANTS.MEMORY_MIN_SCORE,
  });
  return results.results.map(r => r.value).join('\n');
};

/**
 * Store a conversation turn in HeadyOS vector memory.
 */
const storeConversationTurn = async (userId, channelId, userMessage, botResponse) => {
  const namespace = `${BOT_CONSTANTS.MEMORY_NAMESPACE}:${channelId}:${userId}`;
  const turn = `User: ${userMessage}\nHeadyBot: ${botResponse}`;
  await heady.memory.store(
    `turn-${Date.now()}`,
    turn,
    {
      namespace,
      ttlDays: BOT_CONSTANTS.MEMORY_TTL_DAYS,
      metadata: { userId, channelId, timestamp: new Date().toISOString() },
    }
  );
};

/**
 * Build message history for brain.chat from Slack conversation.
 */
const buildMessages = (userMessage, context, agentSystemPrompt) => {
  const messages = [
    {
      role: 'system',
      content: agentSystemPrompt || `You are a helpful AI assistant powered by HeadyOS.
You are integrated with a Slack workspace. Keep responses concise and well-formatted for Slack.
Use *bold*, _italic_, and \`code\` Slack formatting where appropriate.
${context ? `\nConversation context:\n${context}` : ''}`,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ];
  return messages;
};

// ---------------------------------------------------------------------------
// Slack Event Handlers
// ---------------------------------------------------------------------------

/**
 * Handle @mentions in channels.
 */
app.event('app_mention', async ({ event, client, say }) => {
  const userId = event.user;
  const channelId = event.channel;
  // Remove bot mention from text
  const userMessage = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (!userMessage) {
    await say({ text: 'Hi! Ask me anything. Powered by HeadyOS 🤖', thread_ts: event.ts });
    return;
  }

  // Show typing indicator
  await client.chat.update({ channel: channelId, ts: event.ts, text: ':thinking_face: Thinking...' })
    .catch(() => {}); // Ignore if we can't update

  try {
    // Get conversation context from vector memory
    const context = await getConversationContext(userId, channelId, userMessage);
    const messages = buildMessages(userMessage, context);

    // Query HeadyOS brain
    const response = await heady.brain.chat(messages, {
      temperature: BOT_CONSTANTS.DEFAULT_TEMPERATURE,
      maxTokens: BOT_CONSTANTS.MAX_TOKENS,
    });

    const responseText = response.message.content;

    // Reply in thread
    await say({
      text: responseText,
      thread_ts: event.ts,
      mrkdwn: true,
    });

    // Store conversation turn in vector memory
    await storeConversationTurn(userId, channelId, userMessage, responseText);

  } catch (err) {
    console.error('[HeadySlack] Error:', err);
    await say({
      text: `Sorry, I encountered an error: ${err.message}. Please try again.`,
      thread_ts: event.ts,
    });
  }
});

/**
 * Handle direct messages.
 */
app.message(async ({ message, say }) => {
  if (message.bot_id) return; // Ignore bot messages
  if (!message.text) return;

  const userId = message.user;
  const channelId = message.channel;
  const userMessage = message.text;

  try {
    const context = await getConversationContext(userId, channelId, userMessage);
    const messages = buildMessages(userMessage, context);

    const response = await heady.brain.chat(messages, {
      temperature: BOT_CONSTANTS.DEFAULT_TEMPERATURE,
      maxTokens: BOT_CONSTANTS.MAX_TOKENS,
    });

    await say({
      text: response.message.content,
      mrkdwn: true,
    });

    await storeConversationTurn(userId, channelId, userMessage, response.message.content);

  } catch (err) {
    console.error('[HeadySlack] DM error:', err);
    await say({ text: `Error: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// Slash Commands
// ---------------------------------------------------------------------------

/**
 * /heady-ask <question>
 * Quick AI question without conversation context.
 */
app.command('/heady-ask', async ({ command, ack, respond }) => {
  await ack();
  const question = command.text.trim();

  if (!question) {
    await respond({ text: 'Usage: `/heady-ask <your question>`', response_type: 'ephemeral' });
    return;
  }

  await respond({ text: ':thinking_face: Thinking...', response_type: 'in_channel' });

  try {
    const response = await heady.brain.chat([
      { role: 'system', content: 'You are a helpful AI assistant powered by HeadyOS. Be concise.' },
      { role: 'user', content: question },
    ], { temperature: BOT_CONSTANTS.DEFAULT_TEMPERATURE });

    await respond({
      text: `*Question:* ${question}\n\n*Answer:* ${response.message.content}`,
      response_type: 'in_channel',
      mrkdwn: true,
    });
  } catch (err) {
    await respond({ text: `Error: ${err.message}`, response_type: 'ephemeral' });
  }
});

/**
 * /heady-research <topic>
 * Submit a research task to the Heady Conductor for deep analysis.
 */
app.command('/heady-research', async ({ command, ack, respond }) => {
  await ack();
  const topic = command.text.trim();

  if (!topic) {
    await respond({ text: 'Usage: `/heady-research <topic>`', response_type: 'ephemeral' });
    return;
  }

  try {
    const task = await heady.conductor.submitTask({
      type: 'research_report',
      title: `Slack Research: ${topic}`,
      input: {
        topic,
        requestedBy: command.user_name,
        channel: command.channel_name,
        depth: 'standard',
        outputFormat: 'slack_markdown',
      },
      priority: 'normal',
      maxSteps: fib(7), // fib(7)=13 steps
    });

    await respond({
      text: `✓ Research task submitted!\n*Topic:* ${topic}\n*Task ID:* \`${task.taskId}\`\n*Status:* ${task.status}\n\nResults will be posted here when complete.`,
      response_type: 'in_channel',
      mrkdwn: true,
    });

  } catch (err) {
    await respond({ text: `Error submitting research task: ${err.message}`, response_type: 'ephemeral' });
  }
});

// ---------------------------------------------------------------------------
// App Shortcuts
// ---------------------------------------------------------------------------

/**
 * Message shortcut: "Ask HeadyOS"
 * Right-click any Slack message → More message shortcuts → Ask HeadyOS
 */
app.shortcut('ask_headyos', async ({ shortcut, ack, client }) => {
  await ack();
  const messageText = shortcut.message?.text || '';

  try {
    await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'ask_headyos_modal',
        private_metadata: messageText,
        title: { type: 'plain_text', text: 'Ask HeadyOS' },
        submit: { type: 'plain_text', text: 'Ask' },
        blocks: [
          {
            type: 'input',
            block_id: 'question',
            label: { type: 'plain_text', text: 'Your question about this message:' },
            element: {
              type: 'plain_text_input',
              action_id: 'question_input',
              multiline: true,
              initial_value: 'What does this mean?',
            },
          },
        ],
      },
    });
  } catch (err) {
    console.error('[HeadySlack] Shortcut error:', err);
  }
});

app.view('ask_headyos_modal', async ({ ack, view, client, body }) => {
  await ack();
  const question = view.state.values.question.question_input.value;
  const messageContext = view.private_metadata;

  try {
    const response = await heady.brain.chat([
      { role: 'system', content: 'You are a helpful assistant. The user is asking about a Slack message.' },
      { role: 'user', content: `Message context: "${messageContext}"\n\nQuestion: ${question}` },
    ]);

    await client.chat.postMessage({
      channel: body.user.id,
      text: `*Your question:* ${question}\n\n*HeadyOS Answer:*\n${response.message.content}`,
      mrkdwn: true,
    });
  } catch (err) {
    console.error('[HeadySlack] Modal error:', err);
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

(async () => {
  const port = process.env.PORT || fib(12); // fib(12)=144 → port 3144 (we just use 3000 for practicality)
  await app.start(3000);
  console.log(`⚡ HeadyOS Slack Bot is running! (Port 3000)`);
  console.log(`φ = ${PHI} | Fibonacci constants: fib(7)=${fib(7)}, fib(9)=${fib(9)}, fib(11)=${fib(11)}`);
})();

module.exports = { app };
