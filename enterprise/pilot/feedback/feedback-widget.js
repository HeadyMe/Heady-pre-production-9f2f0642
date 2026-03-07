/**
 * @fileoverview HeadyOS Pilot — In-App Feedback Widget
 * @module pilot/feedback/feedback-widget
 *
 * Client-side feedback widget + Express API router.
 * Features: emoji reaction, text feedback, optional screenshot capture.
 * POST /feedback
 *
 * φ = 1.618033988749895
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   SERVER: Express Router
══════════════════════════════════════════════════════════════ */

const express = require('express');
const crypto  = require('crypto');
const { z }   = require('zod');

const router = express.Router();

const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/** Emoji reactions mapped to sentiment scores (φ-normalized) */
const REACTION_SCORES = {
  '😍': 1.0,        // love it
  '😊': PHI - 1,    // 0.618 — positive
  '😐': 0.5,        // neutral
  '😕': 1 - PHI + 1 / PHI,  // ~0.236 — mildly negative
  '😤': 0.0,        // frustrated
};

const REACTION_LABELS = {
  '😍': 'love-it',
  '😊': 'positive',
  '😐': 'neutral',
  '😕': 'mildly-negative',
  '😤': 'frustrated',
};

/** In-memory feedback store (swap for Postgres in production) */
const feedbackStore = [];

/** Schema for feedback submission */
const feedbackSchema = z.object({
  userId:       z.string().min(1),
  tenantId:     z.string().min(1),
  emoji:        z.enum(['😍', '😊', '😐', '😕', '😤']),
  text:         z.string().max(FIB[14]).optional(), // max fib(15)=610 chars
  screenshotB64: z.string().optional(),             // base64 PNG
  context: z.object({
    page:       z.string().optional(),
    agentId:    z.string().optional(),
    taskId:     z.string().optional(),
    featureArea: z.string().optional(),
  }).optional(),
  category: z.enum([
    'general',
    'agent-performance',
    'mcp-tools',
    'ui-ux',
    'documentation',
    'feature-request',
    'bug-report',
  ]).default('general'),
});

/** Emit structured audit event */
const emitEvent = (eventType, data) => {
  const event = {
    eventType,
    timestamp: new Date().toISOString(),
    traceId: crypto.randomUUID(),
    data,
  };
  event.hash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
  console.log(JSON.stringify({ level: 'info', ...event }));
  return event;
};

/**
 * POST /feedback
 * Submit emoji reaction + text feedback + optional screenshot.
 */
router.post('/', (req, res) => {
  const result = feedbackSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: result.error.issues });
  }

  const data = result.data;
  const feedbackId = crypto.randomUUID();
  const sentimentScore = REACTION_SCORES[data.emoji] ?? 0.5;

  const record = {
    feedbackId,
    ...data,
    sentimentScore,
    sentimentLabel:  REACTION_LABELS[data.emoji] ?? 'neutral',
    textLength:      data.text?.length ?? 0,
    hasScreenshot:   !!data.screenshotB64,
    createdAt:       new Date().toISOString(),
    // Don't store raw screenshot in memory — store metadata only
    screenshotStored: !!data.screenshotB64,
    screenshotRef:   data.screenshotB64 ? `screenshots/${feedbackId}.png` : null,
  };

  // Remove raw b64 from stored record
  const { screenshotB64: _b64, ...storedRecord } = record;
  feedbackStore.push(storedRecord);

  emitEvent('FEEDBACK_SUBMITTED', {
    feedbackId,
    userId: data.userId,
    tenantId: data.tenantId,
    emoji: data.emoji,
    sentimentScore,
    category: data.category,
    hasText: !!data.text,
    hasScreenshot: !!data.screenshotB64,
    context: data.context,
  });

  return res.status(201).json({
    feedbackId,
    sentimentScore,
    sentimentLabel: storedRecord.sentimentLabel,
    message: 'Thank you for your feedback. Your input directly shapes HeadyOS.',
  });
});

/**
 * GET /feedback/summary
 * Aggregate feedback summary for a tenant.
 */
router.get('/summary', (req, res) => {
  const { tenantId } = req.query;
  const items = tenantId
    ? feedbackStore.filter(f => f.tenantId === tenantId)
    : feedbackStore;

  if (!items.length) {
    return res.json({ count: 0, avgSentiment: 0, breakdown: {}, topCategories: [] });
  }

  const avgSentiment = items.reduce((s, f) => s + f.sentimentScore, 0) / items.length;

  const breakdown = {};
  Object.keys(REACTION_SCORES).forEach(emoji => {
    const count = items.filter(f => f.emoji === emoji).length;
    breakdown[REACTION_LABELS[emoji]] = {
      emoji, count, pct: Math.round(count / items.length * 100),
    };
  });

  const categoryCounts = {};
  items.forEach(f => {
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
  });
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, FIB[4]) // top fib(5)=5 categories
    .map(([category, count]) => ({ category, count }));

  return res.json({
    count: items.length,
    avgSentiment: Math.round(avgSentiment * 1000) / 1000,
    avgSentimentLabel: avgSentiment > PHI - 1 ? 'positive' : avgSentiment > 0.382 ? 'neutral' : 'negative',
    breakdown,
    topCategories,
    screenshotCount: items.filter(f => f.hasScreenshot).length,
    withTextCount: items.filter(f => f.textLength > 0).length,
  });
});

/* ── Export ──────────────────────────────────────────────────── */
module.exports = router;
module.exports.feedbackStore   = feedbackStore;
module.exports.REACTION_SCORES = REACTION_SCORES;
module.exports.PHI             = PHI;
module.exports.FIB             = FIB;

/* ══════════════════════════════════════════════════════════════
   CLIENT: Feedback Widget (browser bundle — self-contained IIFE)
   Inject via <script> tag or bundler.
══════════════════════════════════════════════════════════════ */

module.exports.clientWidget = `
(function HeadyFeedbackWidget() {
  'use strict';

  const PHI = 1.618033988749895;
  const API_URL = '/feedback';

  const EMOJIS = ['😍', '😊', '😐', '😕', '😤'];
  const EMOJI_LABELS = {
    '😍': 'Love it!',
    '😊': 'Good',
    '😐': 'Neutral',
    '😕': 'Needs work',
    '😤': 'Frustrated',
  };

  let selectedEmoji = null;
  let isOpen = false;

  /** Create widget DOM */
  const createWidget = () => {
    const style = document.createElement('style');
    style.textContent = \`
      .heady-fb-trigger {
        position: fixed; bottom: 24px; right: 24px; z-index: 9000;
        width: 55px; height: 55px;
        background: linear-gradient(135deg, #c9a84c, #8a6f30);
        border: none; border-radius: 50%; cursor: pointer;
        font-size: 22px; color: #0d0e0a;
        box-shadow: 0 4px 21px rgba(201,168,76,0.35);
        transition: transform 250ms cubic-bezier(.34,1.56,.64,1), box-shadow 250ms ease;
        display: flex; align-items: center; justify-content: center;
      }
      .heady-fb-trigger:hover { transform: scale(1.1); box-shadow: 0 8px 34px rgba(201,168,76,0.5); }
      .heady-fb-panel {
        position: fixed; bottom: 92px; right: 24px; z-index: 9001;
        width: 320px;
        background: #1a2233; border: 1px solid rgba(99,148,255,0.2);
        border-radius: 13px; padding: 24px;
        box-shadow: 0 13px 55px rgba(0,0,0,0.6);
        opacity: 0; pointer-events: none; transform: translateY(8px);
        transition: opacity 250ms ease, transform 250ms cubic-bezier(.34,1.56,.64,1);
      }
      .heady-fb-panel.open { opacity: 1; pointer-events: auto; transform: translateY(0); }
      .heady-fb-title { color: #f0f4ff; font-size: 14px; font-weight: 700; margin: 0 0 16px; font-family: 'Space Grotesk', sans-serif; }
      .heady-fb-emojis { display: flex; gap: 8px; margin-bottom: 16px; }
      .heady-fb-emoji {
        width: 44px; height: 44px; border-radius: 8px; border: 1px solid rgba(99,148,255,0.15);
        background: #131924; cursor: pointer; font-size: 20px; transition: all 200ms ease;
        display: flex; align-items: center; justify-content: center;
      }
      .heady-fb-emoji:hover { background: rgba(99,148,255,0.1); border-color: rgba(99,148,255,0.3); transform: scale(1.1); }
      .heady-fb-emoji.selected { background: rgba(201,168,76,0.1); border-color: rgba(201,168,76,0.5); }
      .heady-fb-label { color: #8b9cc8; font-size: 12px; margin-bottom: 12px; min-height: 16px; }
      .heady-fb-textarea {
        width: 100%; background: #131924; border: 1px solid rgba(99,148,255,0.12);
        border-radius: 8px; padding: 10px 12px; color: #f0f4ff; font-size: 13px;
        font-family: inherit; resize: none; outline: none; margin-bottom: 12px;
        transition: border-color 200ms ease;
      }
      .heady-fb-textarea:focus { border-color: rgba(99,148,255,0.4); }
      .heady-fb-screenshot {
        display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
        font-size: 12px; color: #4a5a7a; cursor: pointer;
      }
      .heady-fb-screenshot input { display: none; }
      .heady-fb-submit {
        width: 100%; padding: 10px; background: linear-gradient(135deg,#c9a84c,#8a6f30);
        color: #0d0e0a; border: none; border-radius: 8px; font-weight: 700;
        font-size: 13px; cursor: pointer; transition: all 200ms ease;
      }
      .heady-fb-submit:hover { background: linear-gradient(135deg,#e4c068,#c9a84c); }
      .heady-fb-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      .heady-fb-success { text-align: center; padding: 16px 0; color: #4ecba0; font-size: 13px; display: none; }
    \`;
    document.head.appendChild(style);

    // Trigger button
    const trigger = document.createElement('button');
    trigger.className = 'heady-fb-trigger';
    trigger.innerHTML = '◈';
    trigger.setAttribute('aria-label', 'Open feedback widget');
    trigger.setAttribute('title', 'Share feedback');

    // Panel
    const panel = document.createElement('div');
    panel.className = 'heady-fb-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Feedback');
    panel.innerHTML = \`
      <p class="heady-fb-title">How's it going?</p>
      <div class="heady-fb-emojis" id="heady-emojis"></div>
      <div class="heady-fb-label" id="heady-emoji-label">Select a reaction</div>
      <textarea class="heady-fb-textarea" id="heady-fb-text" rows="3" placeholder="Tell us more (optional)…" maxlength="610"></textarea>
      <label class="heady-fb-screenshot">
        <input type="file" id="heady-screenshot" accept="image/*" />
        📷 Attach screenshot (optional)
        <span id="heady-screenshot-name"></span>
      </label>
      <button class="heady-fb-submit" id="heady-fb-submit" disabled>Send Feedback</button>
      <div class="heady-fb-success" id="heady-fb-success">✓ Thanks! Your feedback shapes HeadyOS.</div>
    \`;

    // Populate emojis
    const emojiContainer = panel.querySelector('#heady-emojis');
    EMOJIS.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'heady-fb-emoji';
      btn.textContent = emoji;
      btn.setAttribute('title', EMOJI_LABELS[emoji]);
      btn.setAttribute('aria-label', EMOJI_LABELS[emoji]);
      btn.addEventListener('click', () => {
        selectedEmoji = emoji;
        emojiContainer.querySelectorAll('.heady-fb-emoji').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        panel.querySelector('#heady-emoji-label').textContent = EMOJI_LABELS[emoji];
        panel.querySelector('#heady-fb-submit').disabled = false;
      });
      emojiContainer.appendChild(btn);
    });

    // Screenshot preview
    panel.querySelector('#heady-screenshot').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        panel.querySelector('#heady-screenshot-name').textContent = file.name;
      }
    });

    // Submit
    panel.querySelector('#heady-fb-submit').addEventListener('click', async () => {
      if (!selectedEmoji) return;

      const submitBtn = panel.querySelector('#heady-fb-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      const screenshotInput = panel.querySelector('#heady-screenshot');
      let screenshotB64 = null;

      if (screenshotInput.files[0]) {
        screenshotB64 = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result.split(',')[1]);
          reader.readAsDataURL(screenshotInput.files[0]);
        });
      }

      const payload = {
        userId:        window.__heady?.userId || 'anonymous',
        tenantId:      window.__heady?.tenantId || 'unknown',
        emoji:         selectedEmoji,
        text:          panel.querySelector('#heady-fb-text').value.trim() || undefined,
        screenshotB64: screenshotB64 || undefined,
        context: {
          page:       window.location.pathname,
          featureArea: document.title,
        },
        category: 'general',
      };

      try {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        submitBtn.style.display = 'none';
        panel.querySelector('#heady-fb-success').style.display = 'block';

        setTimeout(() => {
          panel.classList.remove('open');
          isOpen = false;
        }, 1618); // φ × 1000ms

      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Error — try again';
      }
    });

    // Toggle
    trigger.addEventListener('click', () => {
      isOpen = !isOpen;
      panel.classList.toggle('open', isOpen);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (isOpen && !panel.contains(e.target) && e.target !== trigger) {
        panel.classList.remove('open');
        isOpen = false;
      }
    });

    document.body.appendChild(trigger);
    document.body.appendChild(panel);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
`;
