const fs = require("fs");
const path = require("path");

const fsp = fs.promises;

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

function normalizeVector3(vector) {
    if (!Array.isArray(vector) || vector.length !== 3) {
        throw new Error("vector must be a 3D array [x,y,z]");
    }

    const raw = vector.map((item) => Number(item));
    if (raw.some((v) => !Number.isFinite(v))) {
        throw new Error("vector entries must be finite numbers");
    }

    const mag = Math.sqrt(raw[0] * raw[0] + raw[1] * raw[1] + raw[2] * raw[2]);
    if (mag === 0) return [0, 0, 0];
    return raw.map((v) => v / mag);
}

function cosineSimilarity3(a, b) {
    const va = normalizeVector3(a);
    const vb = normalizeVector3(b);
    return va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
}

function deterministicVector3FromText(text) {
    const value = String(text || "").toLowerCase();
    let x = 0;
    let y = 0;
    let z = 0;

    for (let i = 0; i < value.length; i += 1) {
        const code = value.charCodeAt(i);
        x += (code * (i + 3)) % 97;
        y += (code * (i + 5)) % 193;
        z += (code * (i + 7)) % 389;
    }

    const folded = [clamp01((x % 1000) / 1000), clamp01((y % 1000) / 1000), clamp01((z % 1000) / 1000)];
    return normalizeVector3(folded);
}

class VectorStore3D {
    constructor(storagePath) {
        this.storagePath = path.resolve(storagePath);
    }

    async ensureReady() {
        const dir = path.dirname(this.storagePath);
        await fsp.mkdir(dir, { recursive: true });

        if (!fs.existsSync(this.storagePath)) {
            const initial = { version: 1, items: [] };
            await this.#atomicWrite(initial);
            return initial;
        }

        const loaded = await this.#load();
        if (!Array.isArray(loaded.items)) loaded.items = [];
        return loaded;
    }

    async #load() {
        try {
            const raw = await fsp.readFile(this.storagePath, "utf8");
            return JSON.parse(raw);
        } catch (err) {
            const backupPath = `${this.storagePath}.corrupt.${Date.now()}`;
            try {
                if (fs.existsSync(this.storagePath)) {
                    await fsp.rename(this.storagePath, backupPath);
                }
            } catch { }
            const healed = { version: 1, items: [], healedFromCorruption: true, backupPath };
            await this.#atomicWrite(healed);
            return healed;
        }
    }

    async #atomicWrite(data) {
        const tmp = `${this.storagePath}.tmp`;
        await fsp.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
        await fsp.rename(tmp, this.storagePath);
    }

    async upsert(item) {
        const doc = await this.ensureReady();
        const now = new Date().toISOString();
        const usedVector = normalizeVector3(item.vector || deterministicVector3FromText(`${item.name}:${item.type}:${item.description || ""}`));

        const next = {
            id: item.id,
            type: item.type,
            name: item.name,
            description: item.description || "",
            path: item.path,
            metadata: item.metadata || {},
            vector: usedVector,
            updatedAt: now,
            createdAt: item.createdAt || now,
        };

        const idx = doc.items.findIndex((entry) => entry.id === item.id);
        if (idx >= 0) {
            next.createdAt = doc.items[idx].createdAt || next.createdAt;
            doc.items[idx] = next;
        } else {
            doc.items.push(next);
        }

        await this.#atomicWrite(doc);
        return next;
    }

    async search(query, topK = 5, filters = {}) {
        const doc = await this.ensureReady();
        const queryVector = normalizeVector3(query.vector || deterministicVector3FromText(query.text || ""));

        const matches = doc.items
            .filter((item) => {
                if (filters.type && item.type !== filters.type) return false;
                return true;
            })
            .map((item) => ({
                ...item,
                score: cosineSimilarity3(queryVector, item.vector),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.max(1, Math.min(50, Number(topK) || 5)));

        return { queryVector, total: doc.items.length, matches };
    }

    async stats() {
        const doc = await this.ensureReady();
        const byType = {};
        doc.items.forEach((item) => {
            byType[item.type] = (byType[item.type] || 0) + 1;
        });
        return {
            path: this.storagePath,
            total: doc.items.length,
            byType,
        };
    }
}

module.exports = {
    VectorStore3D,
    deterministicVector3FromText,
    normalizeVector3,
};
