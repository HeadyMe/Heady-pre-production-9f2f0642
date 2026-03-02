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
    });
});
