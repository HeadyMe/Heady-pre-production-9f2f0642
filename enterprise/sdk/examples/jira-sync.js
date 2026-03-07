'use strict';

/**
 * @file jira-sync.js
 * @description Jira issue sync with Heady Conductor tasks.
 * Bidirectional sync: Jira issues → Heady tasks, Heady results → Jira comments.
 *
 * Features:
 * - Sync Jira issues to Heady Conductor tasks
 * - Post AI analysis results back to Jira comments
 * - Auto-label issues based on AI triage
 * - Webhook receiver for Jira events
 * - Polling fallback for batch sync
 */

const express = require('express');
const crypto  = require('crypto');

const PHI = 1.618033988749895;
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const JIRA_CONFIG = {
  baseUrl: process.env.JIRA_BASE_URL,    // e.g., https://your-org.atlassian.net
  apiToken: process.env.JIRA_API_TOKEN,  // Jira API token
  userEmail: process.env.JIRA_USER_EMAIL,
  projectKey: process.env.JIRA_PROJECT_KEY || 'HEADY',
  // Sync interval: fib(7)=13 minutes
  SYNC_INTERVAL_MS: fib(7) * 60 * 1000,
  // Batch size: fib(8)=21 issues
  BATCH_SIZE: fib(8),
  // Max retries: fib(5)=5
  MAX_RETRIES: fib(5),
};

// HeadyOS client (stub — replace with actual import)
const heady = {
  conductor: {
    submitTask: async (task) => ({ taskId: `task-${Date.now()}`, status: 'queued' }),
    getStatus: async (id) => ({ taskId: id, status: 'completed', result: { analysis: 'Mock analysis result' } }),
    waitForCompletion: async (id) => ({ taskId: id, status: 'completed', result: { analysis: 'Mock analysis' } }),
  },
  brain: {
    chat: async (msgs) => ({
      message: { content: JSON.stringify({ priority: 'medium', type: 'feature', estimate: '3 story points', summary: 'Mock triage result' }) }
    })
  },
  memory: { store: async () => {}, search: async () => ({ results: [] }) },
};

// ---------------------------------------------------------------------------
// Jira API Client
// ---------------------------------------------------------------------------

const jiraRequest = async (method, path, body) => {
  const { baseUrl, apiToken, userEmail } = JIRA_CONFIG;
  if (!baseUrl || !apiToken || !userEmail) {
    throw new Error('JIRA_BASE_URL, JIRA_API_TOKEN, and JIRA_USER_EMAIL are required');
  }

  const url = `${baseUrl}/rest/api/3${path}`;
  const headers = {
    'Authorization': `Basic ${Buffer.from(`${userEmail}:${apiToken}`).toString('base64')}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Jira API error: ${response.status} ${response.statusText} for ${method} ${path}`);
  }

  return response.json();
};

// ---------------------------------------------------------------------------
// Jira ↔ Heady Sync Functions
// ---------------------------------------------------------------------------

/**
 * Fetch Jira issues from a project (recent unprocessed).
 */
const fetchJiraIssues = async (projectKey, maxResults = JIRA_CONFIG.BATCH_SIZE) => {
  const jql = `project = ${projectKey} AND created >= -${fib(7)}d ORDER BY created DESC`;
  const data = await jiraRequest('GET', `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,description,status,priority,assignee,labels,issuetype`);
  return data.issues || [];
};

/**
 * Post a comment on a Jira issue.
 */
const postJiraComment = async (issueKey, body) => {
  return jiraRequest('POST', `/issue/${issueKey}/comment`, {
    body: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `🤖 HeadyOS Analysis: ${body}`,
            },
          ],
        },
      ],
    },
  });
};

/**
 * Update a Jira issue label.
 */
const addJiraLabel = async (issueKey, label) => {
  const issue = await jiraRequest('GET', `/issue/${issueKey}?fields=labels`);
  const existingLabels = issue.fields?.labels || [];
  if (!existingLabels.includes(label)) {
    await jiraRequest('PUT', `/issue/${issueKey}`, {
      fields: { labels: [...existingLabels, label, 'heady-analyzed'] },
    });
  }
};

/**
 * Map Jira issue to a Heady Conductor task.
 */
const jiraIssueToHeadyTask = (issue) => ({
  type: 'jira_issue_analysis',
  title: `[${issue.key}] ${issue.fields.summary}`,
  input: {
    issueKey: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
    status: issue.fields.status?.name,
    priority: issue.fields.priority?.name,
    issueType: issue.fields.issuetype?.name,
    assignee: issue.fields.assignee?.displayName,
    labels: issue.fields.labels,
    analysisRequested: [
      'effort_estimate',
      'technical_complexity',
      'risk_assessment',
      'suggested_approach',
      'dependencies',
    ],
  },
  priority: issue.fields.priority?.name === 'Highest' ? 'critical'
    : issue.fields.priority?.name === 'High' ? 'high'
    : 'normal',
  maxSteps: fib(6), // fib(6)=8 steps
  metadata: {
    source: 'jira_sync',
    issueKey: issue.key,
  },
});

/**
 * Sync a single Jira issue to Heady and post results back.
 */
const syncJiraIssue = async (issue) => {
  const issueKey = issue.key;
  console.log(`[Jira] Syncing ${issueKey}: ${issue.fields.summary}`);

  try {
    // Submit to Heady Conductor
    const task = await heady.conductor.submitTask(jiraIssueToHeadyTask(issue));
    console.log(`[Jira] Task submitted for ${issueKey}: ${task.taskId}`);

    // Store mapping in HeadyOS memory
    await heady.memory.store(
      `jira:${issueKey}`,
      `Jira issue ${issueKey}: ${issue.fields.summary} → Heady task ${task.taskId}`,
      { namespace: 'jira-sync', metadata: { issueKey, taskId: task.taskId } }
    );

    // Wait for completion
    const completed = await heady.conductor.waitForCompletion(task.taskId);

    if (completed.status === 'completed' && completed.result) {
      // Post AI analysis back to Jira
      const analysisText = typeof completed.result === 'string'
        ? completed.result
        : JSON.stringify(completed.result, null, 2);

      await postJiraComment(issueKey, analysisText);
      await addJiraLabel(issueKey, 'heady-analyzed');
      console.log(`[Jira] Analysis posted back to ${issueKey}`);
    }

    return { issueKey, taskId: task.taskId, status: completed.status };
  } catch (err) {
    console.error(`[Jira] Error syncing ${issueKey}:`, err.message);
    return { issueKey, error: err.message };
  }
};

/**
 * Batch sync Jira issues to Heady.
 */
const batchSync = async (projectKey) => {
  console.log(`[Jira] Starting batch sync for project ${projectKey}`);
  const issues = await fetchJiraIssues(projectKey);
  console.log(`[Jira] Found ${issues.length} issues to sync`);

  // Process in Fibonacci-sized batches to avoid overwhelming APIs
  const results = [];
  for (let i = 0; i < issues.length; i += fib(4)) { // fib(4)=3
    const batch = issues.slice(i, i + fib(4));
    const batchResults = await Promise.allSettled(batch.map(syncJiraIssue));
    results.push(...batchResults);
    // Rate limit between batches: fib(5)=5 seconds
    if (i + fib(4) < issues.length) {
      await new Promise(r => setTimeout(r, fib(5) * 1000));
    }
  }

  return {
    total: issues.length,
    processed: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
    results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message }),
  };
};

// ---------------------------------------------------------------------------
// Jira Webhook Handler
// ---------------------------------------------------------------------------

app.post('/webhooks/jira', async (req, res) => {
  const event = req.body;
  const webhookEvent = event.webhookEvent;

  console.log(`[Jira] Webhook received: ${webhookEvent}`);

  try {
    let result = null;

    switch (webhookEvent) {
      case 'jira:issue_created':
      case 'jira:issue_updated':
        if (event.issue) {
          result = await syncJiraIssue(event.issue);
        }
        break;
      default:
        console.log(`[Jira] Unhandled webhook event: ${webhookEvent}`);
    }

    res.json({ success: true, event: webhookEvent, result: result || 'acknowledged' });
  } catch (err) {
    console.error('[Jira] Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Manual batch sync endpoint.
 */
app.post('/jira/sync', async (req, res) => {
  const { projectKey } = req.body;
  try {
    const results = await batchSync(projectKey || JIRA_CONFIG.projectKey);
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'heady-jira-sync' }));

// ---------------------------------------------------------------------------
// Scheduled Sync (Fibonacci interval)
// ---------------------------------------------------------------------------

if (process.env.ENABLE_POLLING === 'true') {
  const runScheduledSync = async () => {
    try {
      const results = await batchSync(JIRA_CONFIG.projectKey);
      console.log('[Jira] Scheduled sync complete:', results);
    } catch (err) {
      console.error('[Jira] Scheduled sync error:', err);
    }
    // Re-schedule with fib(7)=13-minute interval
    setTimeout(runScheduledSync, JIRA_CONFIG.SYNC_INTERVAL_MS);
  };
  setTimeout(runScheduledSync, fib(5) * 1000); // Start after fib(5)=5 seconds
  console.log(`[Jira] Scheduled sync enabled (every ${fib(7)} minutes)`);
}

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`[Jira] Heady-Jira sync service running on port ${PORT}`);
});

module.exports = { app, batchSync, syncJiraIssue, jiraIssueToHeadyTask };
