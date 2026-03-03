/**
 * HeadyCreative — Creative engine client (image, music, video, remix)
 */
class HeadyCreative {
    constructor(client) { this._c = client; }

    /** Generate creative content */
    async generate(input, opts = {}) {
        return this._c.post("/api/creative/generate", {
            input, type: opts.type || "text",
            outputType: opts.outputType || "auto",
            model: opts.model || "auto",
            style: opts.style || "default",
        });
    }

    /** Remix multiple inputs */
    async remix(inputs, opts = {}) {
        return this._c.post("/api/creative/remix", {
            inputs, style: opts.style || "blend",
            outputType: opts.outputType || "auto",
        });
    }

    /** List available pipelines */
    async pipelines() {
        return this._c.get("/api/creative/pipelines");
    }

    /** Run a specific pipeline */
    async pipeline(name, input, opts = {}) {
        return this._c.post(`/api/creative/pipeline/${name}`, {
            input, ...opts,
        });
    }

    /** Creative engine health */
    async health() {
        return this._c.get("/api/creative/health");
    }

    /** Canvas operations */
    async canvas(action, opts = {}) {
        return this._c.post("/api/canvas/action", { action, ...opts });
    }
}

module.exports = HeadyCreative;
