"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function EmailConfigPage() {
  const router = useRouter()
  const [provider, setProvider] = useState<"client" | "forward">("forward")
  const [forwardTo, setForwardTo] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/onboarding/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          forwardTo: provider === "forward" ? forwardTo : undefined
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to configure email")
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
              Configure Your Email
            </h1>
            <p className="text-heady-muted">
              Step 2 of 4: Choose how to handle your @headyme.com email
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div
                onClick={() => setProvider("client")}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  provider === "client"
                    ? "border-heady-primary bg-heady-primary/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <h3 className="font-semibold text-heady-foreground mb-1">
                  📧 Use Heady Email Client
                </h3>
                <p className="text-sm text-heady-muted">
                  Access your @headyme.com email through our secure client
                </p>
              </div>

              <div
                onClick={() => setProvider("forward")}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  provider === "forward"
                    ? "border-heady-primary bg-heady-primary/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <h3 className="font-semibold text-heady-foreground mb-1">
                  ↗️ Forward to Another Email
                </h3>
                <p className="text-sm text-heady-muted">
                  Automatically forward emails to your preferred address
                </p>
              </div>
            </div>

            {provider === "forward" && (
              <div className="space-y-2">
                <Label htmlFor="forwardTo">Forward To</Label>
                <Input
                  id="forwardTo"
                  type="email"
                  value={forwardTo}
                  onChange={(e) => setForwardTo(e.target.value)}
                  placeholder="your@email.com"
                  required={provider === "forward"}
                  disabled={loading}
                />
                <p className="text-sm text-heady-muted">
                  Leave empty to use your sign-in email
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
              {loading ? "Configuring..." : "Continue"}
            </Button>
          </form>

          <div className="mt-6 flex justify-center">
            <div className="flex space-x-2">
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
              <div className="w-2 h-2 rounded-full bg-heady-primary"></div>
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
