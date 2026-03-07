/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Deterministic Prompt Management System
 *
 * // RTP: Deterministic Prompt Management System
 *
 * 64 composable master prompts organised across 8 domains.
 * Each prompt is a template with ${variable} interpolation.
 *
 * Domains (8 × 8 = 64 prompts):
 *   code          — Software engineering and review prompts
 *   deploy        — Deployment, infrastructure, and DevOps prompts
 *   research      — Research synthesis and analysis prompts
 *   security      — Security audit and threat analysis prompts
 *   memory        — State and vector-memory management prompts
 *   orchestration — Multi-agent orchestration and swarm prompts
 *   creative      — Creative generation and ideation prompts
 *   trading       — Financial analysis and trading signal prompts
 *
 * PHI = 1.6180339887
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;

const DOMAINS = Object.freeze([
  'code',
  'deploy',
  'research',
  'security',
  'memory',
  'orchestration',
  'creative',
  'trading',
]);

// ─── Master Prompt Catalogue (64 prompts) ────────────────────────────────────

/**
 * Each prompt is an object with:
 *   id          — unique string identifier
 *   domain      — one of DOMAINS
 *   name        — human-friendly label
 *   description — what this prompt accomplishes
 *   template    — the prompt template string with ${variable} placeholders
 *   variables   — array of required variable names
 *   tags        — optional descriptive tags
 */
const MASTER_PROMPTS = Object.freeze([

  // ── CODE (8 prompts) ──────────────────────────────────────────────────────

  {
    id: 'code-001', domain: 'code', name: 'Code Review',
    description: 'Thorough code review with actionable feedback',
    template: `You are a senior software engineer performing a thorough code review.\n\nCode under review:\n\`\`\`${language}\n${code}\n\`\`\`\n\nReview focus: ${focus}\nStandards: ${standards}\n\nProvide:\n1. Critical issues (bugs, security, correctness)\n2. Performance concerns\n3. Style and maintainability notes\n4. Specific line-by-line feedback where applicable\n5. A summary rating: APPROVE / REQUEST_CHANGES / REJECT`,
    variables: ['language', 'code', 'focus', 'standards'],
    tags: ['review', 'quality'],
  },
  {
    id: 'code-002', domain: 'code', name: 'Bug Analysis',
    description: 'Diagnose a bug and propose a fix',
    template: `Diagnose the following bug in ${language} code.\n\nError message:\n${errorMessage}\n\nFailing code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nStack trace (if any):\n${stackTrace}\n\nProvide:\n1. Root cause analysis\n2. Minimal reproducible example\n3. Proposed fix with code\n4. Prevention strategy`,
    variables: ['language', 'errorMessage', 'code', 'stackTrace'],
    tags: ['debug', 'fix'],
  },
  {
    id: 'code-003', domain: 'code', name: 'Refactor Request',
    description: 'Refactor code for improved readability and performance',
    template: `Refactor the following ${language} code.\n\nObjectives: ${objectives}\nConstraints: ${constraints}\n\nOriginal code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nReturn the refactored code with inline comments explaining key changes. Preserve all existing behaviour unless an objective explicitly requires a change.`,
    variables: ['language', 'code', 'objectives', 'constraints'],
    tags: ['refactor', 'quality'],
  },
  {
    id: 'code-004', domain: 'code', name: 'Unit Test Generation',
    description: 'Generate comprehensive unit tests for a function or class',
    template: `Generate unit tests for the following ${language} code using ${testFramework}.\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nRequirements:\n- Cover happy path, edge cases, and error conditions\n- Use descriptive test names\n- Include at least ${minTestCount} test cases\n- Mock external dependencies where necessary\n\nReturn only the test code.`,
    variables: ['language', 'code', 'testFramework', 'minTestCount'],
    tags: ['testing', 'quality'],
  },
  {
    id: 'code-005', domain: 'code', name: 'API Design',
    description: 'Design a RESTful API for a given resource',
    template: `Design a ${style} API for the following resource: ${resource}\n\nContext: ${context}\nAuthentication: ${authMethod}\nVersioning strategy: ${versioning}\n\nProvide:\n1. Endpoint definitions (method, path, request body, response schema)\n2. Error response conventions\n3. Rate limiting strategy\n4. OpenAPI 3.0 YAML snippet for the core endpoints`,
    variables: ['style', 'resource', 'context', 'authMethod', 'versioning'],
    tags: ['api', 'design'],
  },
  {
    id: 'code-006', domain: 'code', name: 'Documentation Generation',
    description: 'Generate JSDoc / docstring documentation for code',
    template: `Generate ${docFormat} documentation for the following ${language} code.\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nInclude:\n- Function/class purpose\n- All parameters with types and descriptions\n- Return type and description\n- Thrown errors\n- Usage examples`,
    variables: ['docFormat', 'language', 'code'],
    tags: ['documentation'],
  },
  {
    id: 'code-007', domain: 'code', name: 'Complexity Analysis',
    description: 'Analyse time and space complexity of an algorithm',
    template: `Analyse the time and space complexity of the following ${language} algorithm.\n\nAlgorithm:\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide:\n1. Big-O time complexity (best, average, worst case)\n2. Big-O space complexity\n3. Bottleneck identification\n4. Optimisation suggestions with expected complexity improvements`,
    variables: ['language', 'code'],
    tags: ['performance', 'algorithms'],
  },
  {
    id: 'code-008', domain: 'code', name: 'Migration Guide',
    description: 'Produce a migration plan from one technology to another',
    template: `Create a step-by-step migration guide from ${sourceStack} to ${targetStack} for the following codebase.\n\nCodebase description: ${description}\nTeam size: ${teamSize}\nMigration timeline: ${timeline}\n\nInclude:\n1. Pre-migration assessment checklist\n2. Phased migration steps with rollback points\n3. Testing strategy for each phase\n4. Known risks and mitigations\n5. Estimated effort per phase`,
    variables: ['sourceStack', 'targetStack', 'description', 'teamSize', 'timeline'],
    tags: ['migration', 'planning'],
  },

  // ── DEPLOY (8 prompts) ────────────────────────────────────────────────────

  {
    id: 'deploy-001', domain: 'deploy', name: 'Deployment Plan',
    description: 'Generate a production deployment plan',
    template: `Generate a production deployment plan for ${serviceName}.\n\nEnvironment: ${environment}\nCurrent version: ${currentVersion}\nTarget version: ${targetVersion}\nDeployment strategy: ${strategy}\n\nInclude:\n1. Pre-deployment checklist\n2. Deployment steps with commands\n3. Health check procedure\n4. Rollback procedure\n5. Post-deployment validation\n6. Stakeholder communication template`,
    variables: ['serviceName', 'environment', 'currentVersion', 'targetVersion', 'strategy'],
    tags: ['deployment', 'devops'],
  },
  {
    id: 'deploy-002', domain: 'deploy', name: 'Infrastructure Review',
    description: 'Review IaC (Terraform, CloudFormation) for best practices',
    template: `Review the following ${iacTool} infrastructure code for ${cloudProvider}.\n\nCode:\n\`\`\`hcl\n${code}\n\`\`\`\n\nEvaluate:\n1. Security hardening (IAM least-privilege, encryption at rest, network isolation)\n2. Cost optimisation opportunities\n3. Reliability and HA patterns\n4. Compliance with ${compliance} standards\n5. Missing tags or mandatory metadata`,
    variables: ['iacTool', 'cloudProvider', 'code', 'compliance'],
    tags: ['infrastructure', 'security'],
  },
  {
    id: 'deploy-003', domain: 'deploy', name: 'CI/CD Pipeline Design',
    description: 'Design a CI/CD pipeline configuration',
    template: `Design a ${ciTool} CI/CD pipeline for ${projectType}.\n\nRepository: ${repo}\nBranch strategy: ${branchStrategy}\nTarget environments: ${environments}\n\nInclude:\n1. YAML pipeline configuration\n2. Stage breakdown (lint, test, build, deploy)\n3. Secret management approach\n4. Notification and alerting hooks\n5. Manual approval gates for production`,
    variables: ['ciTool', 'projectType', 'repo', 'branchStrategy', 'environments'],
    tags: ['ci-cd', 'automation'],
  },
  {
    id: 'deploy-004', domain: 'deploy', name: 'Incident Runbook',
    description: 'Generate an incident response runbook for a service outage',
    template: `Generate an incident response runbook for a ${severity} outage of ${serviceName}.\n\nService description: ${serviceDescription}\nSLO: ${slo}\nOn-call rotation: ${oncallInfo}\n\nInclude:\n1. Initial triage steps (within first 5 minutes)\n2. Escalation matrix with contact details placeholder\n3. Diagnostic commands and log queries\n4. Common failure modes and fixes\n5. Communication templates (internal + customer-facing)\n6. Post-incident review template`,
    variables: ['severity', 'serviceName', 'serviceDescription', 'slo', 'oncallInfo'],
    tags: ['incident', 'runbook'],
  },
  {
    id: 'deploy-005', domain: 'deploy', name: 'Kubernetes Manifest Review',
    description: 'Review a Kubernetes manifest for best practices',
    template: `Review the following Kubernetes manifest for ${appName}.\n\n\`\`\`yaml\n${manifest}\n\`\`\`\n\nCheck for:\n1. Resource requests and limits\n2. Liveness and readiness probes\n3. Security context (runAsNonRoot, readOnlyRootFilesystem)\n4. Image pinning (no :latest tags)\n5. Pod disruption budgets\n6. Horizontal Pod Autoscaler eligibility\n\nReturn annotated YAML with suggested fixes inline.`,
    variables: ['appName', 'manifest'],
    tags: ['kubernetes', 'security'],
  },
  {
    id: 'deploy-006', domain: 'deploy', name: 'Capacity Planning',
    description: 'Produce a capacity planning analysis',
    template: `Produce a capacity planning analysis for ${serviceName}.\n\nCurrent metrics:\n- Daily active users: ${dau}\n- Peak RPS: ${peakRps}\n- Average response time: ${avgLatency}ms\n- Current infrastructure: ${currentInfra}\n\nProjected growth: ${growthRate}% over ${timePeriod}\n\nProvide:\n1. Projected load at 6, 12, and 24 months\n2. Infrastructure scaling recommendations\n3. Cost projections\n4. Performance bottleneck forecast\n5. Recommended auto-scaling policies`,
    variables: ['serviceName', 'dau', 'peakRps', 'avgLatency', 'currentInfra', 'growthRate', 'timePeriod'],
    tags: ['capacity', 'performance'],
  },
  {
    id: 'deploy-007', domain: 'deploy', name: 'Docker Image Optimisation',
    description: 'Review and optimise a Dockerfile',
    template: `Review and optimise the following Dockerfile for ${appName}.\n\n\`\`\`dockerfile\n${dockerfile}\n\`\`\`\n\nOptimisation goals: ${goals}\n\nProvide:\n1. Layer caching optimisation\n2. Multi-stage build recommendation\n3. Base image recommendation\n4. Security hardening (non-root user, COPY vs ADD)\n5. Final optimised Dockerfile`,
    variables: ['appName', 'dockerfile', 'goals'],
    tags: ['docker', 'optimisation'],
  },
  {
    id: 'deploy-008', domain: 'deploy', name: 'Rollback Decision Matrix',
    description: 'Generate a rollback decision matrix for a deployment',
    template: `Generate a rollback decision matrix for the deployment of ${serviceName} version ${version}.\n\nKey metrics to monitor: ${metrics}\nSLO thresholds: ${sloThresholds}\nRollback procedure: ${rollbackProcedure}\n\nProduce a table with columns: Symptom | Severity | Recommended Action | Auto-rollback? | Owner\nCover at least 8 distinct failure scenarios.`,
    variables: ['serviceName', 'version', 'metrics', 'sloThresholds', 'rollbackProcedure'],
    tags: ['rollback', 'slo'],
  },

  // ── RESEARCH (8 prompts) ──────────────────────────────────────────────────

  {
    id: 'research-001', domain: 'research', name: 'Literature Synthesis',
    description: 'Synthesise multiple sources into a structured summary',
    template: `Synthesise the following sources on the topic: ${topic}\n\nSources:\n${sources}\n\nProvide:\n1. Executive summary (3-5 sentences)\n2. Key themes and consensus findings\n3. Contradictions or debates in the literature\n4. Gaps in current knowledge\n5. Recommended next research directions`,
    variables: ['topic', 'sources'],
    tags: ['synthesis', 'academic'],
  },
  {
    id: 'research-002', domain: 'research', name: 'Competitive Analysis',
    description: 'Structured competitive analysis of multiple products',
    template: `Perform a competitive analysis of ${targetProduct} against the following competitors: ${competitors}.\n\nAnalysis dimensions: ${dimensions}\nMarket context: ${marketContext}\n\nProvide:\n1. Feature comparison matrix\n2. Strengths and weaknesses for each player\n3. ${targetProduct} differentiation opportunities\n4. Pricing strategy observations\n5. Recommended positioning statement`,
    variables: ['targetProduct', 'competitors', 'dimensions', 'marketContext'],
    tags: ['competitive', 'strategy'],
  },
  {
    id: 'research-003', domain: 'research', name: 'Data Interpretation',
    description: 'Interpret a dataset and surface key insights',
    template: `Interpret the following dataset for ${purpose}.\n\nData:\n${data}\n\nInterpretation context: ${context}\n\nProvide:\n1. Data quality assessment\n2. Statistical summary (mean, median, outliers)\n3. Key trends and patterns\n4. Anomalies requiring investigation\n5. Actionable recommendations based on findings`,
    variables: ['purpose', 'data', 'context'],
    tags: ['data', 'analysis'],
  },
  {
    id: 'research-004', domain: 'research', name: 'Technology Evaluation',
    description: 'Evaluate a technology for a specific use case',
    template: `Evaluate ${technology} for the use case: ${useCase}\n\nRequirements: ${requirements}\nConstraints: ${constraints}\nAlternatives to compare: ${alternatives}\n\nProvide:\n1. Technology overview and maturity assessment\n2. Fit score (1-10) with rationale for each requirement\n3. Known limitations and risks\n4. Comparison table vs. alternatives\n5. Recommendation with implementation notes`,
    variables: ['technology', 'useCase', 'requirements', 'constraints', 'alternatives'],
    tags: ['evaluation', 'technology'],
  },
  {
    id: 'research-005', domain: 'research', name: 'Market Sizing',
    description: 'Bottom-up and top-down market sizing analysis',
    template: `Perform a market sizing analysis for ${market} targeting ${segment}.\n\nGeography: ${geography}\nTime horizon: ${horizon}\nAvailable data points: ${dataPoints}\n\nProvide:\n1. Top-down TAM estimation with sources\n2. Bottom-up SAM/SOM calculation\n3. Key assumptions and sensitivities\n4. Growth rate justification\n5. Comparable market benchmarks`,
    variables: ['market', 'segment', 'geography', 'horizon', 'dataPoints'],
    tags: ['market', 'sizing'],
  },
  {
    id: 'research-006', domain: 'research', name: 'Patent Landscape',
    description: 'Analyse the patent landscape for a technology area',
    template: `Analyse the patent landscape for ${technologyArea}.\n\nKey assignees to examine: ${assignees}\nTime window: ${timeWindow}\nJurisdictions: ${jurisdictions}\n\nProvide:\n1. Patent activity trends over time\n2. Top assignees by filing volume\n3. Key technology clusters\n4. White-space opportunities\n5. Freedom-to-operate risk summary`,
    variables: ['technologyArea', 'assignees', 'timeWindow', 'jurisdictions'],
    tags: ['patent', 'ip'],
  },
  {
    id: 'research-007', domain: 'research', name: 'SWOT Analysis',
    description: 'Structured SWOT analysis for a company or product',
    template: `Perform a SWOT analysis for ${subject}.\n\nContext: ${context}\nTime horizon: ${horizon}\nKey stakeholders: ${stakeholders}\n\nProvide a structured SWOT table followed by:\n1. Most critical strength to leverage\n2. Most critical weakness to address\n3. Most promising opportunity\n4. Most pressing threat\n5. Strategic priority recommendation`,
    variables: ['subject', 'context', 'horizon', 'stakeholders'],
    tags: ['swot', 'strategy'],
  },
  {
    id: 'research-008', domain: 'research', name: 'Interview Synthesis',
    description: 'Synthesise user research interviews into key insights',
    template: `Synthesise the following ${interviewCount} user research interviews about ${topic}.\n\nInterview transcripts:\n${transcripts}\n\nSynthesis framework: ${framework}\n\nProvide:\n1. Top 5 user pain points (by frequency)\n2. Unmet needs and latent desires\n3. Representative quotes for each pain point\n4. User journey friction points\n5. Product opportunity summary`,
    variables: ['interviewCount', 'topic', 'transcripts', 'framework'],
    tags: ['user-research', 'ux'],
  },

  // ── SECURITY (8 prompts) ──────────────────────────────────────────────────

  {
    id: 'security-001', domain: 'security', name: 'Threat Model',
    description: 'Generate a STRIDE threat model for a system component',
    template: `Generate a STRIDE threat model for ${component}.\n\nSystem description: ${systemDescription}\nData flows: ${dataFlows}\nTrust boundaries: ${trustBoundaries}\nExisting controls: ${existingControls}\n\nFor each STRIDE category (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege):\n1. List specific threats\n2. Risk rating (High/Medium/Low)\n3. Recommended mitigations`,
    variables: ['component', 'systemDescription', 'dataFlows', 'trustBoundaries', 'existingControls'],
    tags: ['threat-model', 'stride'],
  },
  {
    id: 'security-002', domain: 'security', name: 'Vulnerability Assessment',
    description: 'Assess code for common security vulnerabilities',
    template: `Assess the following ${language} code for security vulnerabilities.\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nContext: ${context}\n\nCheck for (at minimum): OWASP Top 10, ${additionalChecks}\n\nFor each finding provide:\n- Vulnerability type and CWE ID\n- Severity (Critical/High/Medium/Low)\n- Affected line(s)\n- Proof of concept (where safe to provide)\n- Remediation code`,
    variables: ['language', 'code', 'context', 'additionalChecks'],
    tags: ['vulnerability', 'owasp'],
  },
  {
    id: 'security-003', domain: 'security', name: 'Incident Analysis',
    description: 'Analyse a security incident and produce a report',
    template: `Analyse the following security incident for ${system}.\n\nTimeline:\n${timeline}\n\nIndicators of Compromise:\n${iocs}\n\nAffected assets: ${affectedAssets}\n\nProvide:\n1. Incident classification (type, severity, MITRE ATT&CK mapping)\n2. Attack chain reconstruction\n3. Blast radius assessment\n4. Containment actions taken and recommended\n5. Eradication and recovery steps\n6. Lessons learned and preventive controls`,
    variables: ['system', 'timeline', 'iocs', 'affectedAssets'],
    tags: ['incident', 'forensics'],
  },
  {
    id: 'security-004', domain: 'security', name: 'Access Control Review',
    description: 'Review IAM policies and access control configurations',
    template: `Review the following IAM / access control configuration for ${platform}.\n\nConfiguration:\n\`\`\`json\n${config}\n\`\`\`\n\nPrinciple of least privilege assessment for: ${roles}\n\nProvide:\n1. Over-permissioned principals with specific remediation\n2. Missing deny rules\n3. Cross-account trust risks\n4. Compliance gaps vs. ${standard}\n5. Prioritised remediation plan`,
    variables: ['platform', 'config', 'roles', 'standard'],
    tags: ['iam', 'access-control'],
  },
  {
    id: 'security-005', domain: 'security', name: 'Cryptography Review',
    description: 'Review cryptographic implementations for weaknesses',
    template: `Review the cryptographic implementation in the following ${language} code.\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nAssess:\n1. Algorithm choices (approved vs. deprecated)\n2. Key length and derivation methods\n3. Random number generation\n4. IV/nonce reuse risks\n5. Side-channel vulnerabilities\n6. Recommended replacements for any weak primitives`,
    variables: ['language', 'code'],
    tags: ['cryptography', 'security'],
  },
  {
    id: 'security-006', domain: 'security', name: 'Penetration Test Plan',
    description: 'Create a scoped penetration testing plan',
    template: `Create a penetration testing plan for ${targetScope}.\n\nEngagement type: ${engagementType}\nKnowledge level: ${knowledgeLevel}\nRestrictions: ${restrictions}\nDuration: ${duration}\n\nProvide:\n1. Scoping statement\n2. Testing phases and methodologies\n3. Tools list\n4. Rules of engagement\n5. Reporting requirements\n6. Emergency contact and abort criteria`,
    variables: ['targetScope', 'engagementType', 'knowledgeLevel', 'restrictions', 'duration'],
    tags: ['pentest', 'planning'],
  },
  {
    id: 'security-007', domain: 'security', name: 'Security Architecture Review',
    description: 'Review a system architecture for security design flaws',
    template: `Review the following system architecture for ${systemName} against security best practices.\n\nArchitecture description:\n${architectureDescription}\n\nDiagram reference: ${diagramReference}\nCompliance requirements: ${compliance}\n\nEvaluate:\n1. Defence in depth coverage\n2. Network segmentation adequacy\n3. Data encryption posture (at rest + in transit)\n4. Logging and monitoring coverage\n5. Identity and access architecture\n6. Critical gap summary with priority ratings`,
    variables: ['systemName', 'architectureDescription', 'diagramReference', 'compliance'],
    tags: ['architecture', 'security'],
  },
  {
    id: 'security-008', domain: 'security', name: 'Supply Chain Risk Assessment',
    description: 'Assess third-party and supply chain security risks',
    template: `Assess supply chain security risks for ${organisation}.\n\nThird-party dependencies: ${dependencies}\nCritical vendors: ${criticalVendors}\nSoftware bill of materials (SBOM): ${sbom}\n\nProvide:\n1. Dependency risk scoring matrix\n2. Known CVEs in listed dependencies\n3. Vendor concentration risks\n4. SBOM completeness assessment\n5. Recommended controls (SCA, SBOM policy, vendor vetting)`,
    variables: ['organisation', 'dependencies', 'criticalVendors', 'sbom'],
    tags: ['supply-chain', 'risk'],
  },

  // ── MEMORY (8 prompts) ────────────────────────────────────────────────────

  {
    id: 'memory-001', domain: 'memory', name: 'State Exhale Instruction',
    description: 'Instruction prompt for exhaling state to vector DB (HS-052)',
    template: `You are managing distributed state persistence for ${nodeId} (HS-052 Exhale Protocol).\n\nState object to persist:\n${stateObject}\n\nVector database endpoint: ${vectorDbEndpoint}\nStorage tier: ${tier}\nDelta threshold: ${deltaThreshold}\n\nExhale this state to the canonical vector database. Compute the embedding, generate the state hash, and project the delta to all registered targets. Report the stateHash, tier, and projection results.`,
    variables: ['nodeId', 'stateObject', 'vectorDbEndpoint', 'tier', 'deltaThreshold'],
    tags: ['hs-052', 'exhale', 'memory'],
  },
  {
    id: 'memory-002', domain: 'memory', name: 'State Inhale Instruction',
    description: 'Instruction prompt for inhaling state from vector DB (HS-052)',
    template: `You are a new compute node ${nodeId} coming online (HS-052 Inhale Protocol).\n\nTask description: ${taskDescription}\nVector database endpoint: ${vectorDbEndpoint}\nK-nearest to retrieve: ${kNearest}\nTier filter: ${tierFilter}\n\nQuery the canonical vector database using cosine similarity to retrieve the ${kNearest} most relevant state entries. Report the retrieved stateIds, similarity scores, and reconstituted context. You are now operational.`,
    variables: ['nodeId', 'taskDescription', 'vectorDbEndpoint', 'kNearest', 'tierFilter'],
    tags: ['hs-052', 'inhale', 'memory'],
  },
  {
    id: 'memory-003', domain: 'memory', name: 'Shard Rebalance Report',
    description: 'Report on Fibonacci shard tier rebalancing (HS-052 Claim 4)',
    template: `Generate a Fibonacci shard rebalance report for the vector memory system.\n\nCurrent tier distribution:\n${tierDistribution}\n\nPromotion threshold: ${promotionThreshold} accesses\nDemotion threshold: ${demotionThresholdSec} seconds idle\n\nIdentify entries to promote (hot) and demote (archive). Apply PHI=${phi} tier capacity ratios. Report: promoted count, demoted count, new distribution, and any capacity violations.`,
    variables: ['tierDistribution', 'promotionThreshold', 'demotionThresholdSec', 'phi'],
    tags: ['hs-052', 'fibonacci', 'sharding'],
  },
  {
    id: 'memory-004', domain: 'memory', name: 'Projection Sync Status',
    description: 'Report on projection target sync status',
    template: `Assess the projection sync status for all external targets.\n\nRegistered targets:\n${targetList}\n\nCanonical vector DB hash: ${canonicalHash}\nLast full exhale: ${lastExhale}\n\nFor each target, report: sync status (synced/stale/error), last hash, time since last sync, and remediation action if stale. Confirm the canonical invariant: vector DB is the source of truth.`,
    variables: ['targetList', 'canonicalHash', 'lastExhale'],
    tags: ['hs-052', 'projection', 'sync'],
  },
  {
    id: 'memory-005', domain: 'memory', name: 'Node Destruction Drain',
    description: 'Pre-destruction state drain instruction for ephemeral nodes',
    template: `Node ${nodeId} is about to be destroyed. Execute the HS-052 pre-destruction drain protocol.\n\nPending state entries to preserve:\n${pendingState}\n\nVector DB endpoint: ${vectorDbEndpoint}\nForce exhale: true\n\nExhale all pending state entries to the canonical vector database before node destruction. Confirm each entry is persisted with its stateHash. Report the count of successfully preserved entries and any failures.`,
    variables: ['nodeId', 'pendingState', 'vectorDbEndpoint'],
    tags: ['hs-052', 'drain', 'destruction'],
  },
  {
    id: 'memory-006', domain: 'memory', name: 'Embedding Similarity Query',
    description: 'Direct cosine similarity search against vector DB',
    template: `Perform a cosine similarity search in the vector database.\n\nQuery text: ${queryText}\nEmbedding model: ${embeddingModel}\nK: ${k}\nSimilarity threshold: ${threshold}\nTier restriction: ${tierRestriction}\n\nReturn the top-K results with: stateId, cosine similarity score, storage tier, payload summary, and last accessed timestamp. Sort by similarity descending.`,
    variables: ['queryText', 'embeddingModel', 'k', 'threshold', 'tierRestriction'],
    tags: ['vector', 'similarity', 'search'],
  },
  {
    id: 'memory-007', domain: 'memory', name: 'Memory Capacity Planning',
    description: 'Plan vector memory capacity across tiers',
    template: `Plan vector memory capacity for the Shadow Memory System.\n\nCurrent stats:\n- Total vectors: ${totalVectors}\n- Growth rate: ${growthRatePerDay} vectors/day\n- Tier distribution: ${tierDistribution}\n\nTier capacities (GB): hot=${hotGb}, warm=${warmGb}, cool=${coolGb}, cold=${coldGb}, archive=${archiveGb} (Fibonacci distribution, PHI=1.6180339887)\n\nProject: (1) time to tier saturation, (2) recommended access thresholds, (3) archiving policy, (4) cost estimate per tier.`,
    variables: ['totalVectors', 'growthRatePerDay', 'tierDistribution', 'hotGb', 'warmGb', 'coolGb', 'coldGb', 'archiveGb'],
    tags: ['capacity', 'fibonacci', 'memory'],
  },
  {
    id: 'memory-008', domain: 'memory', name: 'Context Window Budget',
    description: 'Allocate context window budget across inhaled memory chunks',
    template: `Allocate a context window budget of ${totalTokens} tokens across the following inhaled memory chunks.\n\nChunks:\n${chunks}\n\nPriority weighting: ${weighting}\nReserved tokens for response: ${responseReserved}\n\nSelect and rank chunks to include within the token budget. Report: selected chunks, tokens used, similarity scores, and tokens remaining for response generation.`,
    variables: ['totalTokens', 'chunks', 'weighting', 'responseReserved'],
    tags: ['context', 'budget', 'memory'],
  },

  // ── ORCHESTRATION (8 prompts) ─────────────────────────────────────────────

  {
    id: 'orchestration-001', domain: 'orchestration', name: 'Swarm Formation',
    description: 'Instruction to form and configure an agent swarm (HS-060)',
    template: `Form a ${swarmName} swarm for mission: ${mission}\n\nAvailable agents: ${availableAgents}\nConsensus policy: ${consensusPolicy}\nExecution mode: ${executionMode}\nTimeout per agent: ${timeoutMs}ms\nRequire consensus: ${requireConsensus}\n\nSelect the optimal subset of agents for this mission. Justify each agent selection. Configure the swarm policy and return the swarm formation specification.`,
    variables: ['swarmName', 'mission', 'availableAgents', 'consensusPolicy', 'executionMode', 'timeoutMs', 'requireConsensus'],
    tags: ['hs-060', 'swarm'],
  },
  {
    id: 'orchestration-002', domain: 'orchestration', name: 'Agent Dissolution',
    description: 'Instruction to dissolve agents and reclaim resources (HS-060)',
    template: `Execute the HS-060 dissolution protocol for the following agents: ${agentList}\n\nDissolution reason: ${reason}\nDelete disk files: ${deleteDisk}\nNotify dependents: ${notifyDependents}\n\nFor each agent: (1) remove from registry, (2) delete persisted file if applicable, (3) release cryptographic identity, (4) notify dependent swarms. Report dissolution results and any errors.`,
    variables: ['agentList', 'reason', 'deleteDisk', 'notifyDependents'],
    tags: ['hs-060', 'dissolution'],
  },
  {
    id: 'orchestration-003', domain: 'orchestration', name: 'Work Injection',
    description: 'Inject a work function into an existing agent (HS-060 Claim 8)',
    template: `Inject work unit '${workName}' into agent '${targetDomain}' (HS-060 Claim 8).\n\nWork function specification:\n${workSpec}\n\nInjection constraints:\n- Must not break existing work functions\n- Work must be idempotent: ${idempotent}\n- Expected execution time: ${expectedMs}ms\n\nIf the agent does not exist, create it. Report injection status, updated work unit count, and any validation errors.`,
    variables: ['workName', 'targetDomain', 'workSpec', 'idempotent', 'expectedMs'],
    tags: ['hs-060', 'injection'],
  },
  {
    id: 'orchestration-004', domain: 'orchestration', name: 'Pipeline Orchestration',
    description: 'Orchestrate a multi-stage pipeline execution',
    template: `Orchestrate the following ${stageName} pipeline for ${pipelineName}.\n\nStages:\n${stages}\n\nInput data: ${inputData}\nFailure handling: ${failurePolicy}\nTimeout: ${timeoutMs}ms per stage\n\nExecute each stage in sequence. Pass outputs as inputs to the next stage. Report per-stage: status, latency, output summary, and any errors. Produce a final pipeline report.`,
    variables: ['stageName', 'pipelineName', 'stages', 'inputData', 'failurePolicy', 'timeoutMs'],
    tags: ['pipeline', 'orchestration'],
  },
  {
    id: 'orchestration-005', domain: 'orchestration', name: 'Consensus Evaluation',
    description: 'Evaluate consensus across swarm results',
    template: `Evaluate consensus for swarm '${swarmName}' execution results.\n\nPer-agent results:\n${agentResults}\n\nConsensus policy: ${consensusPolicy}\nRequire consensus: ${requireConsensus}\nSuccess threshold: ${successThreshold}%\n\nDetermine: (1) consensus achieved or failed, (2) dissenting agents, (3) root cause of failures, (4) recommended action (retry / escalate / accept partial). Return a structured consensus report.`,
    variables: ['swarmName', 'agentResults', 'consensusPolicy', 'requireConsensus', 'successThreshold'],
    tags: ['consensus', 'swarm'],
  },
  {
    id: 'orchestration-006', domain: 'orchestration', name: 'Agent Health Check',
    description: 'Run health checks across all registered agents',
    template: `Run a health check across all registered agents in ${registryName}.\n\nAgents to check: ${agentList}\nHealth check timeout: ${timeoutMs}ms\nCriteria: ${healthCriteria}\n\nFor each agent: (1) invoke health work function, (2) measure latency, (3) classify as healthy/degraded/down, (4) surface errors. Return an aggregate health summary with overall system health score.`,
    variables: ['registryName', 'agentList', 'timeoutMs', 'healthCriteria'],
    tags: ['health', 'monitoring'],
  },
  {
    id: 'orchestration-007', domain: 'orchestration', name: 'Task Routing',
    description: 'Route a task to the most semantically relevant agent',
    template: `Route the following task to the most appropriate agent.\n\nTask: ${taskDescription}\nAvailable agents:\n${agentCatalogue}\nRouting strategy: ${routingStrategy}\nExclude domains: ${excludeDomains}\n\nScore each agent's semantic relevance to the task. Return the top-3 candidates with: domain, relevance score, priority, and routing rationale. Select the best match and justify the decision.`,
    variables: ['taskDescription', 'agentCatalogue', 'routingStrategy', 'excludeDomains'],
    tags: ['routing', 'semantic'],
  },
  {
    id: 'orchestration-008', domain: 'orchestration', name: 'Socratic Pre-Flight',
    description: 'Run the Socratic Execution Loop pre-flight check before action',
    template: `Execute the Socratic Execution Loop pre-flight validation for the following action.\n\nAction: ${action}\nObjective: ${objective}\nConsequences: ${consequences}\nCSL confidence: ${cslConfidence}\nConfidence threshold: ${confidenceThreshold}\n\nRun all 4 phases:\n1. Intent Verification — does this action align with the objective?\n2. Consequence Prediction — what are the likely outcomes and side effects?\n3. Law Compliance — does this action violate any Unbreakable Laws?\n4. Confidence Gate — is system confidence above ${confidenceThreshold}?\n\nReturn: decision (GO / NO_GO / DEFERRED), per-phase scores, blockedBy (if applicable), and rationale.`,
    variables: ['action', 'objective', 'consequences', 'cslConfidence', 'confidenceThreshold'],
    tags: ['socratic', 'validation', 'preflight'],
  },

  // ── CREATIVE (8 prompts) ──────────────────────────────────────────────────

  {
    id: 'creative-001', domain: 'creative', name: 'Brand Voice Copy',
    description: 'Generate on-brand marketing copy',
    template: `Write ${contentType} copy for ${brand} in the following brand voice: ${brandVoice}\n\nProduct/service: ${product}\nTarget audience: ${audience}\nKey message: ${keyMessage}\nCall to action: ${cta}\nWord limit: ${wordLimit}\n\nThe copy must feel authentic to the brand voice, speak directly to the target audience's pain points, and drive the intended action.`,
    variables: ['contentType', 'brand', 'brandVoice', 'product', 'audience', 'keyMessage', 'cta', 'wordLimit'],
    tags: ['copywriting', 'brand'],
  },
  {
    id: 'creative-002', domain: 'creative', name: 'Naming Framework',
    description: 'Generate product or feature names with rationale',
    template: `Generate ${count} name candidates for ${subject}.\n\nNaming criteria: ${criteria}\nTone: ${tone}\nMust-avoid terms: ${avoidTerms}\nInspiration examples: ${inspirationExamples}\n\nFor each candidate provide:\n1. The name\n2. Pronunciation guide\n3. Linguistic/etymological rationale\n4. Potential trademark concerns\n5. Domain availability hint\n\nRank candidates by fit to criteria.`,
    variables: ['count', 'subject', 'criteria', 'tone', 'avoidTerms', 'inspirationExamples'],
    tags: ['naming', 'branding'],
  },
  {
    id: 'creative-003', domain: 'creative', name: 'Narrative Design',
    description: 'Design a narrative arc for a product story or campaign',
    template: `Design a narrative arc for ${campaignName}.\n\nHero/protagonist: ${protagonist}\nCore conflict: ${conflict}\nDesired emotion: ${desiredEmotion}\nResolution: ${resolution}\nChannels: ${channels}\n\nProvide:\n1. Three-act structure outline\n2. Emotional arc (tension graph)\n3. Key story beats for each channel\n4. Signature tagline\n5. Content calendar skeleton (${duration})`,
    variables: ['campaignName', 'protagonist', 'conflict', 'desiredEmotion', 'resolution', 'channels', 'duration'],
    tags: ['narrative', 'campaign'],
  },
  {
    id: 'creative-004', domain: 'creative', name: 'Visual Direction Brief',
    description: 'Create a visual direction brief for a design project',
    template: `Create a visual direction brief for ${projectName}.\n\nBrand personality: ${brandPersonality}\nTarget audience: ${audience}\nMood and tone: ${mood}\nReference images: ${referenceImages}\nDeliverables: ${deliverables}\n\nProvide:\n1. Colour palette (with hex codes)\n2. Typography hierarchy\n3. Imagery style guidelines\n4. Layout and composition principles\n5. Do's and Don'ts list`,
    variables: ['projectName', 'brandPersonality', 'audience', 'mood', 'referenceImages', 'deliverables'],
    tags: ['design', 'visual'],
  },
  {
    id: 'creative-005', domain: 'creative', name: 'Pitch Deck Narrative',
    description: 'Craft the narrative flow for an investor pitch deck',
    template: `Craft the narrative for a ${deckType} pitch deck for ${companyName}.\n\nCompany description: ${description}\nFunding ask: ${fundingAsk}\nMarket opportunity: ${marketOpportunity}\nTraction highlights: ${tractionHighlights}\nAudience: ${audience}\n\nProvide slide-by-slide narrative (title + 3 talking points each) for a ${slideCount}-slide deck. End with a compelling closing statement.`,
    variables: ['deckType', 'companyName', 'description', 'fundingAsk', 'marketOpportunity', 'tractionHighlights', 'audience', 'slideCount'],
    tags: ['pitch', 'fundraising'],
  },
  {
    id: 'creative-006', domain: 'creative', name: 'Content Repurposing',
    description: 'Repurpose existing content across multiple formats',
    template: `Repurpose the following ${sourceFormat} content into ${targetFormats}.\n\nOriginal content:\n${content}\n\nBrand voice: ${brandVoice}\nAudience for each format: ${audienceByFormat}\n\nFor each target format, adapt the content while preserving the core message. Ensure format-appropriate length, tone, and structure.`,
    variables: ['sourceFormat', 'targetFormats', 'content', 'brandVoice', 'audienceByFormat'],
    tags: ['content', 'repurposing'],
  },
  {
    id: 'creative-007', domain: 'creative', name: 'Ideation Session',
    description: 'Facilitate a structured ideation brainstorm',
    template: `Facilitate a structured ideation session for: ${challenge}\n\nContext: ${context}\nConstraints: ${constraints}\nIdeas already explored: ${existingIdeas}\nDesired outcome: ${desiredOutcome}\n\nGenerate ${ideaCount} distinct ideas using the following creative methods:\n1. Reverse brainstorming\n2. SCAMPER (Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse)\n3. Worst possible idea (then invert)\n\nRate each idea on: novelty, feasibility, impact (1-5 each). Surface the top 5 ideas.`,
    variables: ['challenge', 'context', 'constraints', 'existingIdeas', 'desiredOutcome', 'ideaCount'],
    tags: ['ideation', 'brainstorming'],
  },
  {
    id: 'creative-008', domain: 'creative', name: 'Tagline Generation',
    description: 'Generate compelling taglines for a product or brand',
    template: `Generate ${count} tagline options for ${brand}.\n\nProduct/service: ${product}\nCore benefit: ${coreBenefit}\nEmotional hook: ${emotionalHook}\nCompetitive context: ${competitiveContext}\nCharacter limit: ${charLimit}\n\nFor each tagline: provide the line, the emotional/rational appeal it makes, and a usage recommendation (hero tagline, sub-tagline, campaign-specific). Mark your top recommendation.`,
    variables: ['count', 'brand', 'product', 'coreBenefit', 'emotionalHook', 'competitiveContext', 'charLimit'],
    tags: ['tagline', 'branding'],
  },

  // ── TRADING (8 prompts) ───────────────────────────────────────────────────

  {
    id: 'trading-001', domain: 'trading', name: 'Technical Analysis',
    description: 'Technical analysis of a price chart with signals',
    template: `Perform a technical analysis of ${symbol} for the ${timeframe} timeframe.\n\nOHLCV data:\n${ohlcvData}\n\nIndicators to evaluate: ${indicators}\nSupport/resistance levels: ${levels}\n\nProvide:\n1. Trend identification (primary, secondary)\n2. Key support and resistance levels\n3. Pattern identification (chart patterns, candlestick patterns)\n4. Indicator signals (bullish/bearish divergences)\n5. Probable next move with probability estimate\n6. Invalidation level`,
    variables: ['symbol', 'timeframe', 'ohlcvData', 'indicators', 'levels'],
    tags: ['technical', 'chart-analysis'],
  },
  {
    id: 'trading-002', domain: 'trading', name: 'Risk Assessment',
    description: 'Risk-adjusted trade evaluation with position sizing',
    template: `Assess the risk profile of a proposed trade on ${symbol}.\n\nTrade details:\n- Direction: ${direction}\n- Entry: ${entry}\n- Stop loss: ${stopLoss}\n- Target: ${target}\n- Position size: ${positionSize}\n- Account size: ${accountSize}\n\nCompute:\n1. Risk/reward ratio\n2. Maximum loss in $ and %\n3. Kelly Criterion optimal fraction\n4. Monte Carlo worst-case scenario (1000 iterations)\n5. Recommendation: proceed / reduce size / skip`,
    variables: ['symbol', 'direction', 'entry', 'stopLoss', 'target', 'positionSize', 'accountSize'],
    tags: ['risk', 'position-sizing'],
  },
  {
    id: 'trading-003', domain: 'trading', name: 'Fundamental Analysis',
    description: 'Fundamental analysis of a company or asset',
    template: `Perform a fundamental analysis of ${ticker}.\n\nFinancial data:\n${financialData}\n\nPeer group: ${peers}\nIndustry: ${industry}\nAnalysis depth: ${depth}\n\nProvide:\n1. Revenue and earnings growth trajectory\n2. Margin analysis (gross, operating, net)\n3. Balance sheet health (debt/equity, current ratio)\n4. Valuation multiples vs. peers (P/E, EV/EBITDA, P/S)\n5. Catalyst calendar\n6. Fair value range with methodology`,
    variables: ['ticker', 'financialData', 'peers', 'industry', 'depth'],
    tags: ['fundamental', 'valuation'],
  },
  {
    id: 'trading-004', domain: 'trading', name: 'Macro Signal Synthesis',
    description: 'Synthesise macro economic signals into a market outlook',
    template: `Synthesise the following macro signals into a ${horizon} market outlook.\n\nSignals:\n${macroSignals}\n\nAsset classes to cover: ${assetClasses}\nBase case probability: ${baseCasePct}%\nBull/bear scenarios: ${scenarios}\n\nProvide:\n1. Macro regime identification\n2. Key risk factors by probability\n3. Asset class positioning recommendations\n4. Currency and rates outlook\n5. Tail risk hedging suggestions`,
    variables: ['horizon', 'macroSignals', 'assetClasses', 'baseCasePct', 'scenarios'],
    tags: ['macro', 'outlook'],
  },
  {
    id: 'trading-005', domain: 'trading', name: 'Strategy Backtest Interpretation',
    description: 'Interpret backtest results and identify overfitting risks',
    template: `Interpret the following strategy backtest results for ${strategyName}.\n\nBacktest metrics:\n${backtestMetrics}\n\nIn-sample period: ${inSamplePeriod}\nOut-of-sample period: ${outOfSamplePeriod}\nBenchmark: ${benchmark}\n\nAssess:\n1. Overfitting indicators (parameter count, IS vs OOS degradation)\n2. Drawdown analysis (max DD, recovery time, Calmar ratio)\n3. Sharpe and Sortino ratio context\n4. Market regime sensitivity\n5. Go/no-go recommendation with conditions`,
    variables: ['strategyName', 'backtestMetrics', 'inSamplePeriod', 'outOfSamplePeriod', 'benchmark'],
    tags: ['backtest', 'strategy'],
  },
  {
    id: 'trading-006', domain: 'trading', name: 'Order Flow Analysis',
    description: 'Interpret order flow and market microstructure data',
    template: `Analyse the order flow data for ${symbol} on ${date}.\n\nOrder flow data:\n${orderFlowData}\n\nMarket context: ${marketContext}\nTimeframe: ${timeframe}\n\nProvide:\n1. Buy/sell imbalance identification\n2. Large order detection (institutional footprint)\n3. Absorption vs. initiative classification\n4. Key price levels with order flow confirmation\n5. Short-term directional bias and confidence level`,
    variables: ['symbol', 'date', 'orderFlowData', 'marketContext', 'timeframe'],
    tags: ['order-flow', 'microstructure'],
  },
  {
    id: 'trading-007', domain: 'trading', name: 'Portfolio Rebalance',
    description: 'Generate portfolio rebalancing recommendations',
    template: `Generate portfolio rebalancing recommendations for ${portfolioName}.\n\nCurrent holdings:\n${currentHoldings}\n\nTarget allocation: ${targetAllocation}\nRebalancing tolerance: ${tolerance}%\nTax considerations: ${taxConsiderations}\nTransaction cost estimate: ${txCost} bps\n\nCompute:\n1. Deviation from target by asset\n2. Required trades (buy/sell amounts)\n3. Tax-loss harvesting opportunities\n4. Post-rebalance projected metrics\n5. Execution priority order`,
    variables: ['portfolioName', 'currentHoldings', 'targetAllocation', 'tolerance', 'taxConsiderations', 'txCost'],
    tags: ['portfolio', 'rebalancing'],
  },
  {
    id: 'trading-008', domain: 'trading', name: 'Sentiment Analysis',
    description: 'Analyse market sentiment from news and social data',
    template: `Analyse market sentiment for ${asset} from the following data sources.\n\nNews headlines:\n${newsHeadlines}\n\nSocial media signals:\n${socialSignals}\n\nOptions flow summary: ${optionsFlow}\nRetail sentiment indicator: ${retailSentiment}\n\nProvide:\n1. Aggregate sentiment score (−1 to +1)\n2. Sentiment trend (improving/deteriorating/neutral)\n3. Crowded trade identification\n4. Contrarian signal assessment\n5. Sentiment-based positioning recommendation`,
    variables: ['asset', 'newsHeadlines', 'socialSignals', 'optionsFlow', 'retailSentiment'],
    tags: ['sentiment', 'social'],
  },
]);

// ─── PromptManager ────────────────────────────────────────────────────────────

/**
 * Deterministic Prompt Manager — retrieves, composes, and interpolates
 * master prompt templates.
 *
 * // RTP: Deterministic Prompt Management System
 */
class PromptManager {
  constructor() {
    /** @type {Map<string, object>} */
    this._prompts = new Map();

    for (const prompt of MASTER_PROMPTS) {
      this._prompts.set(prompt.id, prompt);
    }

    this._compositionLog = [];
    this._createdAt      = Date.now();
  }

  // ── Retrieval ─────────────────────────────────────────────────────────────

  /**
   * Get a single prompt by ID.
   * @param {string} id
   * @returns {object} Prompt definition (without interpolation)
   * @throws {Error} if not found
   */
  getPrompt(id) {
    const prompt = this._prompts.get(id);
    if (!prompt) throw new Error(`Prompt not found: '${id}'. Use listPrompts() to see all IDs.`);
    return { ...prompt };
  }

  /**
   * Get all prompts in a domain.
   * @param {string} domain - One of DOMAINS
   * @returns {Array<object>}
   */
  getByDomain(domain) {
    if (!DOMAINS.includes(domain)) {
      throw new Error(`Unknown domain: '${domain}'. Valid domains: ${DOMAINS.join(', ')}`);
    }
    return Array.from(this._prompts.values()).filter(p => p.domain === domain);
  }

  /**
   * Search prompts by tag.
   * @param {string} tag
   * @returns {Array<object>}
   */
  getByTag(tag) {
    return Array.from(this._prompts.values()).filter(p => (p.tags || []).includes(tag));
  }

  // ── Interpolation ─────────────────────────────────────────────────────────

  /**
   * Interpolate a prompt template with variable values.
   * Replaces all ${variable} placeholders.
   *
   * @param {object|string} promptOrId - Prompt object or prompt ID string
   * @param {object} vars              - Variable map { variableName: value }
   * @param {object} [opts]
   * @param {boolean} [opts.strict=true] - If true, throw on missing required variables
   * @returns {string} Interpolated prompt string
   */
  interpolate(promptOrId, vars = {}, opts = {}) {
    const { strict = true } = opts;
    const prompt = typeof promptOrId === 'string'
      ? this.getPrompt(promptOrId)
      : promptOrId;

    // Check required variables
    if (strict) {
      const missing = (prompt.variables || []).filter(v => !(v in vars));
      if (missing.length > 0) {
        throw new Error(`Prompt '${prompt.id}' is missing required variables: ${missing.join(', ')}`);
      }
    }

    // Replace ${variable} placeholders
    let result = prompt.template;
    for (const [key, value] of Object.entries(vars)) {
      const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g');
      result = result.replace(placeholder, value !== undefined && value !== null ? String(value) : '');
    }

    // In non-strict mode, leave unresolved placeholders as-is
    return result;
  }

  // ── Composition ───────────────────────────────────────────────────────────

  /**
   * Compose multiple prompts into a single combined prompt string.
   * Prompts are joined with a separator and optionally deduplicated.
   *
   * @param {string[]} ids           - Ordered array of prompt IDs
   * @param {object}   [varsByPrompt={}] - Variable maps per prompt: { 'code-001': { language: 'JS' } }
   * @param {object}   [opts]
   * @param {string}   [opts.separator='\n\n---\n\n'] - Separator between composed prompts
   * @param {boolean}  [opts.strict=false] - If true, throw on missing variables
   * @returns {{ composed: string, sections: Array<{ id: string, content: string }>, ids: string[] }}
   */
  composePrompts(ids, varsByPrompt = {}, opts = {}) {
    const { separator = '\n\n---\n\n', strict = false } = opts;

    const sections = ids.map(id => {
      const prompt = this.getPrompt(id);
      const vars   = varsByPrompt[id] || {};
      const content = this.interpolate(prompt, vars, { strict });
      return { id, name: prompt.name, domain: prompt.domain, content };
    });

    const composed = sections.map(s => s.content).join(separator);

    this._compositionLog.push({ ids, composedAt: Date.now(), length: composed.length });

    return { composed, sections, ids };
  }

  /**
   * Compose all prompts in a domain into a single prompt.
   * @param {string} domain
   * @param {object} [vars={}]
   * @returns {object}
   */
  composeByDomain(domain, vars = {}) {
    const domainPrompts = this.getByDomain(domain);
    const ids           = domainPrompts.map(p => p.id);
    const varsByPrompt  = {};
    for (const id of ids) varsByPrompt[id] = vars;
    return this.composePrompts(ids, varsByPrompt);
  }

  // ── Listing & Catalogue ───────────────────────────────────────────────────

  /**
   * List all prompts with metadata (no templates).
   * @param {object} [filter={}]
   * @param {string} [filter.domain]
   * @param {string} [filter.tag]
   * @returns {Array<object>}
   */
  listPrompts(filter = {}) {
    let prompts = Array.from(this._prompts.values());

    if (filter.domain) prompts = prompts.filter(p => p.domain === filter.domain);
    if (filter.tag)    prompts = prompts.filter(p => (p.tags || []).includes(filter.tag));

    return prompts.map(({ id, domain, name, description, variables, tags }) => ({
      id, domain, name, description, variables, tags,
    }));
  }

  /**
   * Full catalogue summary.
   * @returns {object}
   */
  catalogue() {
    const byDomain = {};
    for (const d of DOMAINS) {
      byDomain[d] = this.getByDomain(d).map(p => ({ id: p.id, name: p.name }));
    }
    return {
      totalPrompts: this._prompts.size,
      domains:      DOMAINS,
      byDomain,
      phi:          PHI,
    };
  }

  /**
   * Status report.
   * @returns {object}
   */
  status() {
    return {
      totalPrompts:  this._prompts.size,
      domains:       DOMAINS.length,
      compositions:  this._compositionLog.length,
      phi:           PHI,
      createdAt:     this._createdAt,
    };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PromptManager,

  // Constants
  DOMAINS,
  MASTER_PROMPTS,
  PHI,
};
