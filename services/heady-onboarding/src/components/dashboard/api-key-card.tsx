"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface ApiKeyCardProps {
  apiKey: string
}

export function ApiKeyCard({ apiKey }: ApiKeyCardProps) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const displayKey = revealed 
    ? apiKey 
    : `${apiKey.substring(0, 12)}${"*".repeat(52)}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-heady-foreground">
          🔑 API Key
        </h3>
        <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
          Active
        </span>
      </div>

      <div className="mb-4">
        <div className="bg-slate-950 border border-slate-700 rounded p-3 font-mono text-xs text-heady-foreground break-all">
          {displayKey}
        </div>
      </div>

      <div className="flex space-x-2">
        <Button
          onClick={() => setRevealed(!revealed)}
          variant="outline"
          className="flex-1 text-xs"
        >
          {revealed ? "🙈 Hide" : "👁️ Reveal"}
        </Button>
        <Button
          onClick={copyToClipboard}
          variant="outline"
          className="flex-1 text-xs"
        >
          {copied ? "✅ Copied!" : "📋 Copy"}
        </Button>
      </div>

      <p className="text-xs text-heady-muted mt-3">
        Use this key to authenticate with HeadyMCP, HeadyCloud, and all Heady APIs.
      </p>
    </div>
  )
}
