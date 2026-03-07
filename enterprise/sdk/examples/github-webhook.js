'use strict';

/**
 * @file github-webhook.js
 * @description GitHub webhook handler that triggers Heady agents on PR and push events.
 *
 * Supported events:
 * - pull_request: opened, synchronize, ready_for_review → AI code review
 * - push: to main/master → Security scan + deployment decision
 * - issues: opened → AI triage and label suggestion
 * - pull_request_review_comment: → AI respond to review comments
 *
 * Setup:
 * 1. Add webhook in GitHub repo: Settings → Webhooks → Add webhook
 * 2. Payload URL: https://your-domain.com/webhooks/github
 * 3. Content type: application/json
 * 4. Secret: set GITHUB_WEBHOOK_SECRET env var
 * 5. Events: Pull requests, Pushes, Issues
 */

const express = require('express');
const crypto  = require('crypto');

const PHI = 1.618033988749895;
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

const app = express();
app.use(express.json({ limit: `${fib(10)}mb` })); // fib(10)=55 MB limit

// ---------------------------------------------------------------------------
// GitHub Webhook Signature Verification
// ---------------------------------------------------------------------------

const verifySignature = (payload, signature) => {
  if (!signature) return false;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) throw new Error('GITHUB_WEBHOOK_SECRET not set');
  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(
    Buffer.from(digest, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
};

// ---------------------------------------------------------------------------
// HeadyOS Client (stub — replace with actual import)
// ---------------------------------------------------------------------------
const heady = {
  conductor: {
    submitTask: async (task) => ({ taskId: `task-${Date.now()}`, status: 'queued', ...task }),
    getStatus: async (id) => ({ taskId: id, status: 'completed', result: 'Mock result' }),
  },
  brain: {
    chat: async (msgs) => ({ message: { content: 'AI response for: ' + msgs[msgs.length-1].content.substring(0,50) } })
  },
  memory: { store: async () => {}, search: async () => ({ results: [] }) },
};

// ---------------------------------------------------------------------------
// PR Code Review Handler
// ---------------------------------------------------------------------------

/**
 * Trigger AI code review when a PR is opened or updated.
 */
const handlePullRequest = async (payload) => {
  const { action, pull_request, repository } = payload;

  if (!['opened', 'synchronize', 'ready_for_review'].includes(action)) return null;
  if (pull_request.draft && action !== 'ready_for_review') return null;

  const prInfo = {
    number: pull_request.number,
    title: pull_request.title,
    body: pull_request.body || '',
    author: pull_request.user.login,
    baseBranch: pull_request.base.ref,
    headBranch: pull_request.head.ref,
    changedFiles: pull_request.changed_files,
    additions: pull_request.additions,
    deletions: pull_request.deletions,
    repo: repository.full_name,
    url: pull_request.html_url,
    diffUrl: pull_request.diff_url,
  };

  console.log(`[GitHub] PR #${prInfo.number} ${action}: ${prInfo.title}`);

  // Submit code review task to Heady Conductor
  const task = await heady.conductor.submitTask({
    type: 'code_review',
    title: `PR #${prInfo.number}: ${prInfo.title}`,
    input: {
      pullRequest: prInfo,
      reviewType: 'comprehensive',
      checkList: [
        'code_quality',
        'security_vulnerabilities',
        'performance_issues',
        'test_coverage',
        'documentation',
        'breaking_changes',
      ],
      context: `Repository: ${prInfo.repo}. Base: ${prInfo.baseBranch}. ${prInfo.changedFiles} files changed (+${prInfo.additions}/-${prInfo.deletions}).`,
    },
    priority: action === 'ready_for_review' ? 'high' : 'normal',
    maxSteps: fib(7), // fib(7)=13 steps
    metadata: {
      source: 'github_webhook',
      event: 'pull_request',
      action,
    },
  });

  return {
    event: 'pull_request',
    action,
    prNumber: prInfo.number,
    taskId: task.taskId,
    status: task.status,
  };
};

// ---------------------------------------------------------------------------
// Push to Main Handler
// ---------------------------------------------------------------------------

/**
 * Analyze security and deployment readiness on push to main.
 */
const handlePush = async (payload) => {
  const { ref, repository, commits, pusher } = payload;

  // Only process main/master branch
  if (ref !== 'refs/heads/main' && ref !== 'refs/heads/master') return null;

  const pushInfo = {
    branch: ref.replace('refs/heads/', ''),
    commitsCount: commits.length,
    pusher: pusher.name,
    repo: repository.full_name,
    latestCommit: commits[0],
    addedFiles: commits.flatMap(c => c.added || []),
    modifiedFiles: commits.flatMap(c => c.modified || []),
    removedFiles: commits.flatMap(c => c.removed || []),
  };

  console.log(`[GitHub] Push to ${pushInfo.branch}: ${pushInfo.commitsCount} commits by ${pushInfo.pusher}`);

  // Run security scan on push
  const task = await heady.conductor.submitTask({
    type: 'security_scan',
    title: `Push to ${pushInfo.branch} — Security Analysis`,
    input: {
      push: pushInfo,
      scanTypes: ['dependency_vulnerabilities', 'secret_exposure', 'code_injection', 'xss_patterns'],
      deploymentDecision: true,
    },
    priority: 'high',
    maxSteps: fib(6), // fib(6)=8 steps
    metadata: { source: 'github_webhook', event: 'push' },
  });

  return {
    event: 'push',
    branch: pushInfo.branch,
    taskId: task.taskId,
    status: task.status,
  };
};

// ---------------------------------------------------------------------------
// Issue Triage Handler
// ---------------------------------------------------------------------------

/**
 * AI triage for new issues — suggest labels, priority, and assignee.
 */
const handleIssue = async (payload) => {
  const { action, issue, repository } = payload;
  if (action !== 'opened') return null;

  const issueInfo = {
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    author: issue.user.login,
    repo: repository.full_name,
    url: issue.html_url,
  };

  console.log(`[GitHub] Issue #${issueInfo.number} opened: ${issueInfo.title}`);

  // AI triage: classify, suggest labels, estimate severity
  const response = await heady.brain.chat([
    {
      role: 'system',
      content: `You are a GitHub issue triage assistant. Analyze issues and suggest:
1. Issue type (bug/feature/documentation/question/enhancement)
2. Priority (critical/high/medium/low)
3. Labels (max ${fib(4)}=3)
4. Brief triage summary (max ${fib(8)}=21 words)

Respond in valid JSON: {"type": "...", "priority": "...", "labels": [...], "summary": "..."}`,
    },
    {
      role: 'user',
      content: `Issue #${issueInfo.number}: ${issueInfo.title}\n\n${issueInfo.body}`,
    },
  ]);

  let triage;
  try {
    triage = JSON.parse(response.message.content);
  } catch {
    triage = { type: 'unknown', priority: 'medium', labels: ['needs-triage'], summary: 'Manual review needed' };
  }

  // Store in memory for context
  await heady.memory.store(
    `issue-${issueInfo.number}`,
    `Issue #${issueInfo.number}: ${issueInfo.title} — ${triage.summary}`,
    { namespace: `github:${issueInfo.repo}`, metadata: { triage, issueNumber: issueInfo.number } }
  );

  return {
    event: 'issues',
    action,
    issueNumber: issueInfo.number,
    triage,
  };
};

// ---------------------------------------------------------------------------
// Express Webhook Endpoint
// ---------------------------------------------------------------------------

app.post('/webhooks/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];

  // Verify signature
  const rawBody = JSON.stringify(req.body);
  if (!verifySignature(rawBody, signature)) {
    console.warn('[GitHub] Invalid webhook signature — rejected');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  console.log(`[GitHub] Webhook received: ${event} (delivery: ${deliveryId})`);

  try {
    let result = null;

    switch (event) {
      case 'pull_request':
        result = await handlePullRequest(req.body);
        break;
      case 'push':
        result = await handlePush(req.body);
        break;
      case 'issues':
        result = await handleIssue(req.body);
        break;
      default:
        console.log(`[GitHub] Unhandled event: ${event}`);
    }

    res.json({
      success: true,
      event,
      deliveryId,
      processed: result !== null,
      result: result || { message: `Event ${event} acknowledged but not processed` },
    });

  } catch (err) {
    console.error('[GitHub] Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'heady-github-webhook' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[GitHub] Heady GitHub webhook handler listening on port ${PORT}`);
  console.log(`[GitHub] Webhook URL: http://localhost:${PORT}/webhooks/github`);
});

module.exports = { app, handlePullRequest, handlePush, handleIssue };
