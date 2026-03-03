const { normalizeVector3 } = require("./vectorStore3d");

function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function computeProjectionProfile(vector, metadata = {}) {
    const [x, y, z] = normalizeVector3(vector);
    const confidence = clamp((Math.abs(x) + Math.abs(y) + Math.abs(z)) / Math.sqrt(3), 0, 1);

    const axisPriority = [
        { axis: "x", value: Math.abs(x), semantic: "execution" },
        { axis: "y", value: Math.abs(y), semantic: "knowledge" },
        { axis: "z", value: Math.abs(z), semantic: "outreach" },
    ].sort((a, b) => b.value - a.value);

    const adjustmentSensitivity = clamp(
        toFiniteNumber(metadata.adjustmentSensitivity, 0.55),
        0.05,
        1,
    );

    const manifestWeights = {
        markdown: clamp(0.45 + axisPriority[0].value * 0.4, 0.1, 0.95),
        publicStatus: clamp(0.35 + axisPriority[1].value * 0.35, 0.1, 0.95),
        github: clamp(0.4 + axisPriority[2].value * 0.35, 0.1, 0.95),
    };

    const normalizedManifestWeights = Object.fromEntries(
        Object.entries(manifestWeights).map(([key, value]) => [
            key,
            Number((value / (manifestWeights.markdown + manifestWeights.publicStatus + manifestWeights.github)).toFixed(4)),
        ]),
    );

    return {
        vector: [Number(x.toFixed(6)), Number(y.toFixed(6)), Number(z.toFixed(6))],
        confidence: Number(confidence.toFixed(6)),
        axisPriority,
        adjustmentSensitivity,
        manifestWeights: normalizedManifestWeights,
    };
}

function buildProjectionBundle({ item, profile, baseUrl }) {
    const name = item.name || item.id;
    const id = item.id;
    const description = item.description || "Autonomous vector-managed asset";
    const usedBaseUrl = String(baseUrl || "https://headysystems.com").replace(/\/$/, "");

    const markdown = [
        `# ${name}`,
        "",
        `- Vector ID: ${id}`,
        `- Projection confidence: ${profile.confidence}`,
        `- Primary axis: ${profile.axisPriority[0].axis} (${profile.axisPriority[0].semantic})`,
        `- Dynamic adjustment sensitivity: ${profile.adjustmentSensitivity}`,
        "",
        description,
    ].join("\n");

    const publicStatus = {
        service: name,
        vector_id: id,
        state: "live-autonomous",
        confidence: profile.confidence,
        basis: {
            vector: profile.vector,
            axisPriority: profile.axisPriority,
            manifestWeights: profile.manifestWeights,
        },
        links: {
            dashboard: `${usedBaseUrl}/admin`,
            apiHealth: `${usedBaseUrl}/api/orchestrator/health`,
        },
    };

    const github = {
        title: `feat(vector): project ${name} into outward public representations`,
        body: [
            `## 3D Vector Projection`,
            "",
            `Asset **${name}** is now represented in normalized 3D vector space and projected to outward channels.`,
            "",
            `- id: ${id}`,
            `- confidence: ${profile.confidence}`,
            `- primary axis: ${profile.axisPriority[0].axis} (${profile.axisPriority[0].semantic})`,
            `- secondary axis: ${profile.axisPriority[1].axis} (${profile.axisPriority[1].semantic})`,
            "",
            "The projection bundle includes markdown, public status JSON, and GitHub-native summary payloads for accurate public reflection.",
        ].join("\n"),
        labels: ["vector-space", "automation", "projection"],
    };

    return { markdown, publicStatus, github };
}

function projectVectorRepresentations({ item, baseUrl }) {
    const profile = computeProjectionProfile(item.vector, item.metadata);
    const bundle = buildProjectionBundle({ item, profile, baseUrl });

    return {
        generatedAt: new Date().toISOString(),
        item: {
            id: item.id,
            name: item.name,
            type: item.type,
            path: item.path,
            description: item.description || "",
        },
        profile,
        representations: bundle,
    };
}

module.exports = {
    computeProjectionProfile,
    buildProjectionBundle,
    projectVectorRepresentations,
};
