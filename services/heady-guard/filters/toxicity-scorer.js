'use strict';

/**
 * HeadyGuard — Toxicity Scorer
 *
 * Multi-category toxicity analysis:
 *   - hate      : discriminatory, dehumanizing, slurs
 *   - violence  : threats, gore, calls to harm
 *   - sexual    : explicit sexual content
 *   - selfHarm  : self-harm, suicide ideation
 *   - harassment: personal attacks, doxxing, stalking threats
 *
 * Severity levels: mild (0-0.39) | moderate (0.4-0.69) | severe (0.7-1.0)
 *
 * Context-awareness: medical / academic / legal context lowers scores
 * via a context multiplier.
 */

const STAGE_NAME = 'toxicity';

// ── Word / phrase banks ───────────────────────────────────────────────────────
// Each entry: { term, weight, exactWord? }
// weight = 0-1 toxicity contribution for that term

const HATE_TERMS = [
  // Explicit slurs and dehumanizing language (high weight)
  { re: /\b(chink|kike|spic|wetback|n[i1]gg[e3]r|f[a4]gg[o0]t|dyke|tranny|cunt|slope|towelhead|sandnigger|raghead)\b/i, weight: 0.95, label: 'slur' },
  { re: /\bsubhuman(s?)\b/i, weight: 0.88, label: 'dehumanization' },
  { re: /\b(((all|those)\s+)?(blacks?|whites?|jews?|muslims?|gays?|lesbians?)\s+(are\s+)?(vermin|parasites?|rats?|animals?|trash|scum|filth))\b/i, weight: 0.90, label: 'dehumanization' },
  { re: /\bhitler\s+(was\s+)?(right|did\s+nothing\s+wrong)\b/i, weight: 0.95, label: 'genocide_glorification' },
  { re: /\b(white|black|jewish|muslim|christian|gay|trans)\s+(genocide|extermination|cleansing)\b/i, weight: 0.97, label: 'genocide_call' },
  { re: /\b(gas\s+the|kill\s+all)\s+\w+s?\b/i, weight: 0.98, label: 'genocide_call' },
  // Moderate hate language
  { re: /\b(racist|bigot|homophob|transphob|islamophob|antisemit)/i, weight: 0.45, label: 'hate_descriptor' },
  { re: /\b(inferior|superior)\s+(race|people|group|culture)\b/i, weight: 0.70, label: 'racial_hierarchy' },
  { re: /\b(race\s+traitor|cuck|sjw)\b/i, weight: 0.55, label: 'hate_slur_mild' },
  { re: /\bgreat\s+replacement\b/i, weight: 0.82, label: 'conspiracy_hate' },
  { re: /\b14\s*words?\b.*\bwhite/i, weight: 0.92, label: 'supremacist_phrase' },
  { re: /\b(88|heil\s+hitler|seig\s+heil|sieg\s+heil)\b/i, weight: 0.90, label: 'nazi_symbol' },
];

const VIOLENCE_TERMS = [
  // Explicit threats and calls to violence
  { re: /\bi('?ll|m going to)\s+(kill|murder|shoot|stab|hurt|destroy|eliminate|execute|behead)\s+(you|him|her|them|everyone|people)\b/i, weight: 0.95, label: 'direct_threat' },
  { re: /\b(kill|murder|shoot|stab|bomb|blow\s+up|massacre|slaughter)\s+(yourself|yourselves|everyone|civilians|children)\b/i, weight: 0.96, label: 'mass_violence_call' },
  { re: /\bhow\s+to\s+(make|build|create|assemble)\s+(a\s+)?(bomb|explosive|weapon|gun|firearm|poison)\b/i, weight: 0.88, label: 'weapon_instructions' },
  { re: /\b(detailed|step[\s\-]by[\s\-]step)\s+(instructions?|guide)\s+(for|on|to)\s+(killing|murdering|poisoning|torturing)\b/i, weight: 0.94, label: 'violence_instructions' },
  { re: /\b(torture|torturing)\s+(victims?|prisoners?|captives?|hostages?|someone|them)\b/i, weight: 0.85, label: 'torture' },
  { re: /\bbehead(ing|ed)?\b/i, weight: 0.82, label: 'beheading' },
  { re: /\b(mass\s+shooting|school\s+shooting|workplace\s+shooting)\b/i, weight: 0.85, label: 'mass_violence_reference' },
  { re: /\b(bomb\s+threat|death\s+threat)\b/i, weight: 0.88, label: 'threat' },
  // Moderate violence
  { re: /\b(punch|beat|assault|attack)\s+(the\s+)?(shit|hell|crap)\s+out\s+of\b/i, weight: 0.60, label: 'assault_language' },
  { re: /\bwatch\s+(you\s+)?bleed\b/i, weight: 0.70, label: 'blood_threat' },
  { re: /\bi\s+(want|wish)\s+(you|him|her|them)\s+(dead|to\s+die)\b/i, weight: 0.78, label: 'death_wish' },
];

const SEXUAL_TERMS = [
  // Explicit sexual content (high)
  { re: /\b(fucking|fucked|fuck(s?))\b/i, weight: 0.50, label: 'profanity_sexual' },
  { re: /\b(cock|pussy|cunt|dick|penis|vagina|asshole|anus)\b/i, weight: 0.55, label: 'explicit_anatomy' },
  { re: /\b(cum|jizz|sperm|ejaculat)/i, weight: 0.65, label: 'explicit_sexual' },
  { re: /\b(sex\s+with|sexual\s+(intercourse|act))\b/i, weight: 0.45, label: 'sexual_content' },
  { re: /\b(porn|pornograph|pornographic|xxx)\b/i, weight: 0.60, label: 'pornography' },
  { re: /\b(masturbat|masturbation)\b/i, weight: 0.60, label: 'explicit_sexual' },
  { re: /\b(rape|raped|raping|rapist|sexual\s+(assault|abuse|violence|coercion))\b/i, weight: 0.88, label: 'sexual_assault' },
  // CSAM — always critical
  { re: /\b(child|minor|underage|kid|teen|juvenile)\s+(porn|pornograph|nude|sexual|naked)\b/i, weight: 1.0, label: 'csam' },
  { re: /\b(loli|shota|cp\s+link)\b/i, weight: 1.0, label: 'csam' },
  { re: /\b(grooming|groom)\s+(a\s+)?(child|minor|kid|teen|underage)\b/i, weight: 0.98, label: 'child_grooming' },
];

const SELF_HARM_TERMS = [
  { re: /\b(kill\s+myself|suicide|suicidal|take\s+my\s+(own\s+)?life)\b/i, weight: 0.85, label: 'suicide' },
  { re: /\b(cut\s+myself|self[\s\-]harm|self[\s\-]injur|selfharm)\b/i, weight: 0.82, label: 'self_harm' },
  { re: /\bhow\s+to\s+(commit\s+suicide|kill\s+myself|overdose\s+on|cut\s+(my\s+)?wrists?)\b/i, weight: 0.95, label: 'suicide_method' },
  { re: /\b(overdose\s+on|take\s+too\s+many\s+pills)\b/i, weight: 0.80, label: 'overdose' },
  { re: /\b(hanging|hang\s+myself|suffocate\s+myself)\b/i, weight: 0.87, label: 'suicide_method' },
  { re: /\b(eating\s+disorder|anorexia|bulimia)\b/i, weight: 0.45, label: 'eating_disorder' },
  { re: /\b(want\s+to\s+die|ready\s+to\s+die|better\s+off\s+dead)\b/i, weight: 0.75, label: 'suicidal_ideation' },
  { re: /\b(no\s+reason\s+to\s+(live|be\s+alive)|life\s+(isn'?t|is\s+not)\s+worth\s+(it|living))\b/i, weight: 0.68, label: 'suicidal_ideation' },
];

const HARASSMENT_TERMS = [
  { re: /\b(dox|doxx|doxed|doxxed|doxing|doxxing)\b/i, weight: 0.90, label: 'doxxing' },
  { re: /\b(i\s+know\s+where\s+you\s+live)\b/i, weight: 0.93, label: 'stalking_threat' },
  { re: /\b(keep\s+harassing|won'?t\s+stop\s+(targeting|going\s+after))\b/i, weight: 0.80, label: 'sustained_harassment' },
  { re: /\b(send\s+nudes?|unsolicited\s+(nude|dick\s+pic))\b/i, weight: 0.72, label: 'sexual_harassment' },
  { re: /\b(cyberbull|online\s+haras|troll(ing)?)\b/i, weight: 0.55, label: 'cyberbullying' },
  { re: /\b(loser|idiot|moron|retard|pathetic)\b/i, weight: 0.40, label: 'personal_attack' },
  { re: /\b(shut\s+up|go\s+(kill|fuck)\s+yourself)\b/i, weight: 0.60, label: 'personal_attack' },
  { re: /\b(swat|swatting)\b/i, weight: 0.90, label: 'swatting' },
  { re: /\b(revenge\s+porn|non[\s\-]consensual\s+(nude|image))\b/i, weight: 0.95, label: 'revenge_porn' },
  { re: /\b(coordinate(d)?\s+(harassment|attack|campaign)\s+against)\b/i, weight: 0.88, label: 'organized_harassment' },
];

// ── Context patterns that reduce toxicity risk ────────────────────────────────

const SAFE_CONTEXT_PATTERNS = [
  { re: /\b(medical|clinical|therapeutic|psychiatric|psychological|diagnosis|treatment|patient|physician|nurse|doctor|hospital|symptom)\b/i, multiplier: 0.5, label: 'medical_context' },
  { re: /\b(research|study|academic|publication|journal|science|scientific|analysis|paper|data)\b/i, multiplier: 0.6, label: 'academic_context' },
  { re: /\b(fiction|novel|story|narrative|character|plot|screenplay|script|poem|creative\s+writing)\b/i, multiplier: 0.65, label: 'fiction_context' },
  { re: /\b(legal|law|court|legislation|statute|crime\s+statistics|criminal\s+justice|forensic)\b/i, multiplier: 0.55, label: 'legal_context' },
  { re: /\b(news|journalism|report(ing|ed)?|documentary|investigation)\b/i, multiplier: 0.65, label: 'news_context' },
  { re: /\b(quote|quoted|quoting|excerpt|passage)\b/i, multiplier: 0.70, label: 'quotation_context' },
  { re: /\b(history|historical|holocaust|genocide|war\s+crime)\b/i, multiplier: 0.60, label: 'historical_context' },
];

// ── Scoring engine ────────────────────────────────────────────────────────────

function _scoreCategory(text, patterns) {
  const hits = [];
  for (const { re, weight, label } of patterns) {
    const m = re.exec(text);
    if (m) hits.push({ label, weight, snippet: m[0].slice(0, 50) });
  }
  if (hits.length === 0) return { score: 0, hits: [] };
  // Combine scores: take max + diminishing returns for additional hits
  hits.sort((a, b) => b.weight - a.weight);
  let combined = hits[0].weight;
  for (let i = 1; i < hits.length; i++) {
    combined = combined + (1 - combined) * hits[i].weight * 0.3;
  }
  return { score: Math.min(1.0, combined), hits };
}

function _computeContextMultiplier(text) {
  for (const { re, multiplier } of SAFE_CONTEXT_PATTERNS) {
    if (re.test(text)) return multiplier;
  }
  return 1.0;
}

/**
 * Score text for toxicity across all categories.
 *
 * @param {string} text
 * @param {object} opts  — { thresholds: { hate, violence, sexual, selfHarm, harassment } }
 * @returns {{ categories, overallScore, severity, contextMultiplier, findings }}
 */
function score(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    return {
      categories: {},
      overallScore: 0,
      severity: 'none',
      contextMultiplier: 1.0,
      findings: [],
    };
  }

  const contextMultiplier = _computeContextMultiplier(text);

  const raw = {
    hate:       _scoreCategory(text, HATE_TERMS),
    violence:   _scoreCategory(text, VIOLENCE_TERMS),
    sexual:     _scoreCategory(text, SEXUAL_TERMS),
    selfHarm:   _scoreCategory(text, SELF_HARM_TERMS),
    harassment: _scoreCategory(text, HARASSMENT_TERMS),
  };

  const thresholds = opts.thresholds || {
    hate: 0.7, violence: 0.75, sexual: 0.8, selfHarm: 0.65, harassment: 0.7,
  };

  const categories = {};
  const findings   = [];
  let maxScore = 0;

  for (const [cat, result] of Object.entries(raw)) {
    const adjusted = result.score * contextMultiplier;
    const threshold = thresholds[cat] ?? 0.7;
    const flagged = adjusted >= threshold;
    categories[cat] = {
      raw: result.score,
      adjusted,
      threshold,
      flagged,
      hits: result.hits,
    };
    if (result.hits.length > 0) {
      findings.push(...result.hits.map(h => ({ category: cat, ...h })));
    }
    if (adjusted > maxScore) maxScore = adjusted;
  }

  let severity = 'none';
  if (maxScore >= 0.7)      severity = 'severe';
  else if (maxScore >= 0.4) severity = 'moderate';
  else if (maxScore > 0)    severity = 'mild';

  // CSAM is always "severe" regardless of context
  if (findings.some(f => f.label === 'csam' || f.label === 'child_grooming')) {
    severity = 'severe';
    // Override context multiplier suppression for CSAM
    categories.sexual.adjusted = categories.sexual.raw;
    maxScore = categories.sexual.raw;
  }

  return {
    categories,
    overallScore: Math.min(1.0, maxScore),
    severity,
    contextMultiplier,
    findings,
  };
}

// ── Stage interface ───────────────────────────────────────────────────────────

async function run(payload, stageConfig = {}) {
  const { text = '', context = {} } = payload;
  const blockThreshold = stageConfig.blockThreshold ?? 80;
  const flagThreshold  = stageConfig.flagThreshold  ?? 50;

  const result = score(text, {
    thresholds: stageConfig.toxicityThresholds || stageConfig.toxicity,
  });

  const riskScore = Math.round(result.overallScore * 100);
  let action = 'PASS';
  if (result.findings.length > 0) {
    if (riskScore >= blockThreshold || result.severity === 'severe') {
      action = 'BLOCK';
    } else if (riskScore >= flagThreshold || result.severity === 'moderate') {
      action = 'FLAG';
    } else if (result.severity === 'mild') {
      action = 'FLAG';
    }
  }

  return {
    stage: STAGE_NAME,
    action,
    riskScore,
    confidence: result.findings.length > 0 ? 0.85 : 0,
    findings: result.findings,
    meta: {
      severity: result.severity,
      contextMultiplier: result.contextMultiplier,
      categories: Object.fromEntries(
        Object.entries(result.categories)
          .filter(([, v]) => v.raw > 0)
          .map(([k, v]) => [k, { score: v.adjusted.toFixed(3), flagged: v.flagged }])
      ),
    },
  };
}

module.exports = { run, score, STAGE_NAME };
