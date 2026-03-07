"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function PermissionsPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"cloud" | "hybrid">("cloud")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/onboarding/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, filesystemAccess: mode === "hybrid" })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to set permissions")
        setLoading(false)
        return
      }

      router.push(data.nextStep)
    } catch (err) {
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-heady-background via-slate-900 to-heady-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-heady-foreground mb-2">
              Choose Your Environment
            </h1>
            <p className="text-heady-muted">
              Step 3 of 4: Select how Heady operates
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div
                onClick={() => setMode("cloud")}
                className={`p-6 border rounded-lg cursor-pointer transition-all ${
                  mode === "cloud"
                    ? "border-heady-primary bg-heady-primary/10 shadow-lg shadow-heady-primary/20"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="text-3xl">☁️</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-heady-foreground mb-2">
                      Cloud Only
                    </h3>
                    <p className="text-sm text-heady-muted mb-3">
                      Work entirely in 3D cloud workspaces. Perfect for accessing Heady from anywhere.
                    </p>
                    <ul className="text-xs text-heady-muted space-y-1">
                      <li>✓ Access from any device</li>
                      <li>✓ Automatic backups</li>
                      <li>✓ Zero local storage</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setMode("hybrid")}
                className={`p-6 border rounded-lg cursor-pointer transition-all ${
                  mode === "hybrid"
                    ? "border-heady-primary bg-heady-primary/10 shadow-lg shadow-heady-primary/20"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="text-3xl">🔄</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-heady-foreground mb-2">
                      Hybrid (Cloud + Filesystem)
                    </h3>
                    <p className="text-sm text-heady-muted mb-3">
                      Combine cloud workspaces with local filesystem access for maximum flexibility.
                    </p>
                    <ul className="text-xs text-heady-muted space-y-1">
                      <li>✓ Local file access</li>
                      <li>✓ Cloud synchronization</li>
                      <li>✓ Best of both worlds</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {mode === "hybrid" && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-200">
                  ⚠️ Hybrid mode requires HeadyOS installation on your local machine for filesystem access.
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Setting Permissions..." : "Continue"}
            </Button>
          </form>

          <div className="mt-6 flex justify-center">
            <div className="flex space-x-2">
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
              <div className="w-2 h-2 rounded-full bg-heady-primary"></div>
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
