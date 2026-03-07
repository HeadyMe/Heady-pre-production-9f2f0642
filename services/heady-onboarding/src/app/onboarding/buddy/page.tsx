"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CustomUI {
  id: string
  name: string
  config: Record<string, any>
}

interface Context {
  id: string
  name: string
  active: boolean
}

export default function BuddyPage() {
  const router = useRouter()
  const [customUIs, setCustomUIs] = useState<CustomUI[]>([
    { id: "default", name: "Default Workspace", config: { theme: "dark" } }
  ])
  const [contexts, setContexts] = useState<Context[]>([
    { id: "dev", name: "Development", active: true },
    { id: "research", name: "Research", active: false },
    { id: "personal", name: "Personal", active: false }
  ])
  const [newUIName, setNewUIName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const addCustomUI = () => {
    if (newUIName.trim()) {
      setCustomUIs([
        ...customUIs,
        {
          id: `ui-${Date.now()}`,
          name: newUIName,
          config: { theme: "dark", layout: "standard" }
        }
      ])
      setNewUIName("")
    }
  }

  const toggleContext = (id: string) => {
    setContexts(contexts.map(ctx =>
      ctx.id === id ? { ...ctx, active: !ctx.active } : ctx
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/onboarding/buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customUIs,
          contexts,
          preferences: {
            theme: "dark",
            notifications: true,
            autoSave: true
          }
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to configure buddy")
        setLoading(false)
        return
      }

      // Complete onboarding
      await fetch("/api/onboarding/complete", { method: "POST" })
      router.push("/dashboard")
    } catch (err) {
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-heady-background via-slate-900 to-heady-background p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-heady-foreground mb-2">
              Meet HeadyBuddy 🧠
            </h1>
            <p className="text-heady-muted">
              Step 4 of 4: Customize your AI companion
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Custom UIs */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-heady-foreground mb-2">
                  Custom Workspaces
                </h3>
                <p className="text-sm text-heady-muted mb-4">
                  Create different UI layouts for different tasks
                </p>
              </div>

              <div className="space-y-2">
                {customUIs.map((ui) => (
                  <div
                    key={ui.id}
                    className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center justify-between"
                  >
                    <span className="text-heady-foreground">{ui.name}</span>
                    <span className="text-xs text-heady-muted">
                      {ui.id === "default" ? "Default" : "Custom"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex space-x-2">
                <Input
                  value={newUIName}
                  onChange={(e) => setNewUIName(e.target.value)}
                  placeholder="New workspace name"
                  disabled={loading}
                />
                <Button
                  type="button"
                  onClick={addCustomUI}
                  variant="outline"
                  disabled={loading || !newUIName.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Contexts */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-heady-foreground mb-2">
                  Context Switcher
                </h3>
                <p className="text-sm text-heady-muted mb-4">
                  Quickly switch between different working contexts
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {contexts.map((ctx) => (
                  <div
                    key={ctx.id}
                    onClick={() => toggleContext(ctx.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      ctx.active
                        ? "border-heady-primary bg-heady-primary/10"
                        : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">
                        {ctx.active ? "✅" : "⭕"}
                      </div>
                      <div className="font-medium text-heady-foreground">
                        {ctx.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Finalizing Setup..." : "Complete Setup"}
            </Button>
          </form>

          <div className="mt-6 flex justify-center">
            <div className="flex space-x-2">
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
              <div className="w-2 h-2 rounded-full bg-heady-primary"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
