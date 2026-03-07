export default function HeadyIODocsPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 text-white">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <header className="text-center mb-16">
                    <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Heady I/O
                    </h1>
                    <p className="text-xl text-slate-400 mt-4">
                        Developer Documentation &amp; SDK Reference
                    </p>
                </header>

                <section className="space-y-8">
                    <DocSection title="Getting Started" href="/docs/quickstart" description="Install the SDK and make your first API call in under 5 minutes." />
                    <DocSection title="MCP Protocol" href="/docs/mcp" description="31 MCP tools, Streamable HTTP + SSE transport, multi-tenant support." />
                    <DocSection title="Vector Memory API" href="/docs/vector-memory" description="3D octree-indexed vector memory with namespace isolation and pgvector backend." />
                    <DocSection title="Authentication" href="/docs/auth" description="JWT + OAuth2 PKCE + API Keys — cross-domain session management." />
                    <DocSection title="Bee Swarm" href="/docs/bees" description="24-domain autonomous bee swarm with factory pattern, lifecycle, and observability." />
                    <DocSection title="Deployment" href="/docs/deploy" description="Cloud Run, Cloudflare Workers, Docker, PM2 — multi-target deployment." />
                </section>
            </div>
        </main>
    );
}

function DocSection({ title, href, description }: { title: string; href: string; description: string }) {
    return (
        <a href={href} className="block bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:border-emerald-500/50 transition-all group">
            <h2 className="text-xl font-semibold group-hover:text-emerald-400 transition-colors">{title}</h2>
            <p className="text-slate-400 mt-2">{description}</p>
        </a>
    );
}
