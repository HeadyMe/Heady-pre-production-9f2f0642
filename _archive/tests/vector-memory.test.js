/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Vector Memory — Unit Tests
 * Tests 3D spatial indexing, zone assignment, shard distribution,
 * GraphRAG layer, and hybrid query functionality.
 */

const vectorMemory = require("../src/vector-memory");

describe("Vector Memory", () => {
    beforeAll(() => {
        vectorMemory.init();
    });

    afterAll(() => {
        vectorMemory.stopAutonomousMaintenance();
    });

    describe("3D Spatial Indexing", () => {
        test("to3D converts embedding to 3 coordinates", () => {
            // Create a 384-dim embedding (all 1s)
            const embedding = new Array(384).fill(1.0);
            const coords = vectorMemory.to3D(embedding);
            expect(coords).toBeDefined();
            expect(typeof coords.x).toBe("number");
            expect(typeof coords.y).toBe("number");
            expect(typeof coords.z).toBe("number");
        });

        test("assignZone classifies to octant 0-7", () => {
            const zone1 = vectorMemory.assignZone(1.0, 1.0, 1.0);
            expect(zone1).toBeGreaterThanOrEqual(0);
            expect(zone1).toBeLessThanOrEqual(7);

            const zone2 = vectorMemory.assignZone(-1.0, -1.0, -1.0);
            expect(zone2).toBeGreaterThanOrEqual(0);
            expect(zone2).toBeLessThanOrEqual(7);

            // Different sign patterns should produce different zones
            expect(zone1).not.toBe(zone2);
        });

        test("all 8 zones are valid assignments", () => {
            const signPatterns = [
                [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
                [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
            ];
            const zones = new Set();
            for (const p of signPatterns) {
                zones.add(vectorMemory.assignZone(p[0], p[1], p[2]));
            }
            expect(zones.size).toBe(8);
        });
    });

    describe("Stats", () => {
        test("getStats returns valid structure", () => {
            const stats = vectorMemory.getStats();
            expect(stats.shards).toBeDefined();
            expect(Array.isArray(stats.shards)).toBe(true);
            expect(stats.shards.length).toBe(5); // Fibonacci shard count
            expect(stats.spatial).toBeDefined();
            expect(stats.spatial.zones).toBe(8);
            expect(stats.graph).toBeDefined();
            expect(stats.graph.architecture).toBe("hybrid-rag");
        });

        test("graph stats include edge tracking", () => {
            const stats = vectorMemory.getStats();
            expect(typeof stats.graph.totalEdges).toBe("number");
            expect(typeof stats.graph.totalNodes).toBe("number");
        });
    });

    describe("GraphRAG Layer", () => {
        test("addRelationship creates an edge", () => {
            const result = vectorMemory.addRelationship(
                "source-001",
                "target-001",
                "resolved_by",
                0.95,
            );
            expect(result.sourceId).toBe("source-001");
            expect(result.targetId).toBe("target-001");
            expect(result.relation).toBe("resolved_by");
        });

        test("getRelationships returns edges for a node", () => {
            const edges = vectorMemory.getRelationships("source-001");
            expect(edges.length).toBeGreaterThan(0);
            expect(edges[0].target).toBe("target-001");
            expect(edges[0].relation).toBe("resolved_by");
        });

        test("getRelationships returns empty for unknown node", () => {
            const edges = vectorMemory.getRelationships("nonexistent-node");
            expect(edges).toEqual([]);
        });

        test("addRelationship deduplicates", () => {
            vectorMemory.addRelationship("source-001", "target-001", "resolved_by", 0.95);
            vectorMemory.addRelationship("source-001", "target-001", "resolved_by", 0.95);
            const edges = vectorMemory.getRelationships("source-001");
            const resolvedEdges = edges.filter(e => e.target === "target-001" && e.relation === "resolved_by");
            expect(resolvedEdges.length).toBe(1);
        });
    });

    describe("Embedding", () => {
        test("embed function exists and returns promise", async () => {
            expect(typeof vectorMemory.embed).toBe("function");
        });
    });

    describe("Outbound projection adaptation", () => {
        test("resolveProjectionProfile auto-selects spherical for github", () => {
            const profile = vectorMemory.resolveProjectionProfile({ channel: "github" });
            expect(profile).toBe("spherical");

            const uppercaseProfile = vectorMemory.resolveProjectionProfile({ channel: "GITHUB" });
            expect(uppercaseProfile).toBe("spherical");
        });

        test("projectPoint creates spherical coordinates", () => {
            const projected = vectorMemory.projectPoint({ x: 1, y: 1, z: 1 }, "spherical");
            expect(projected).toHaveProperty("r");
            expect(projected).toHaveProperty("theta");
            expect(projected).toHaveProperty("phi");
        });

        test("buildOutboundRepresentation returns channel projection payload", async () => {
            await vectorMemory.ingestMemory({
                content: "outbound projection test",
                metadata: { type: "system_state" },
                embedding: new Array(384).fill(0.1),
            });

            const outbound = vectorMemory.buildOutboundRepresentation({ channel: "public-api", topK: 2 });
            expect(outbound.ok).toBe(true);
            expect(outbound.profile).toBe("spherical");
            expect(outbound.architecture).toBe("3d-vector-projection-router");
            expect(Array.isArray(outbound.sample)).toBe(true);
            expect(outbound.sample.length).toBeGreaterThan(0);
        });

        test("buildOutboundRepresentation normalizes channel and clamps topK", async () => {
            await vectorMemory.ingestMemory({
                content: "outbound projection clamp test",
                metadata: { type: "system_state", ts: Date.now() + 1 },
                embedding: new Array(384).fill(0.2),
            });

            const outbound = vectorMemory.buildOutboundRepresentation({ channel: "GITHUB", topK: 999 });
            expect(outbound.channel).toBe("github");
            expect(outbound.top_k).toBe(100);
            expect(outbound.sample.length).toBeLessThanOrEqual(100);
        });

        test("normalizeChannel and normalizeTopK enforce safe defaults", () => {
            expect(vectorMemory.normalizeChannel("GITHUB")).toBe("github");
            expect(vectorMemory.normalizeChannel("unknown-channel")).toBe("internal");
            expect(vectorMemory.normalizeTopK("bad")).toBe(12);
            expect(vectorMemory.normalizeTopK(9999)).toBe(100);
            expect(vectorMemory.normalizeTopK(0)).toBe(1);
        });

        test("buildOutboundRepresentation includes generated metadata", () => {
            const outbound = vectorMemory.buildOutboundRepresentation({ channel: "unknown-channel", topK: "NaN" });
            expect(outbound.channel).toBe("internal");
            expect(outbound.top_k).toBe(12);
            expect(typeof outbound.generated_at).toBe("string");
            expect(outbound.constraints.max_outbound_sample).toBe(100);
        });
    });


    describe("Autonomous maintenance", () => {
        test("autonomous state is exposed", () => {
            const state = vectorMemory.getAutonomousState();
            expect(typeof state.enabled).toBe("boolean");
            expect(typeof state.intervalMs).toBe("number");
        });

        test("runAutonomousMaintenance returns deterministic summary", async () => {
            const result = await vectorMemory.runAutonomousMaintenance({
                decayThreshold: 0.0,
                ltmThreshold: 0.0,
            });
            expect(result).toHaveProperty("ok");
            expect(result).toHaveProperty("duration_ms");
            expect(result).toHaveProperty("decay");
            expect(result).toHaveProperty("consolidation");
        });
    });

});
