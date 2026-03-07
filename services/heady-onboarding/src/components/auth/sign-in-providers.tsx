"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const providers = [
  { id: "google", name: "Google", icon: "🔍" },
  { id: "github", name: "GitHub", icon: "🐙" },
  { id: "huggingface", name: "Hugging Face", icon: "🤗" },
  { id: "microsoft", name: "Microsoft", icon: "🪟" },
  { id: "apple", name: "Apple", icon: "🍎" },
  { id: "discord", name: "Discord", icon: "💬" },
  { id: "twitter", name: "Twitter", icon: "🐦" },
  { id: "linkedin", name: "LinkedIn", icon: "💼" },
  { id: "auth0", name: "Auth0", icon: "🔐" },
  { id: "okta", name: "Okta", icon: "🔒" },
  { id: "slack", name: "Slack", icon: "💼" },
  { id: "spotify", name: "Spotify", icon: "🎵" },
  { id: "gitlab", name: "GitLab", icon: "🦊" },
  { id: "bitbucket", name: "Bitbucket", icon: "🪣" },
  { id: "facebook", name: "Facebook", icon: "👥" },
  { id: "reddit", name: "Reddit", icon: "🤖" },
  { id: "twitch", name: "Twitch", icon: "🎮" },
  { id: "dropbox", name: "Dropbox", icon: "📦" },
  { id: "atlassian", name: "Atlassian", icon: "🔷" },
  { id: "keycloak", name: "Keycloak", icon: "🔑" },
  { id: "azure-ad", name: "Azure AD", icon: "☁️" },
  { id: "salesforce", name: "Salesforce", icon: "☁️" },
  { id: "notion", name: "Notion", icon: "📝" },
  { id: "trello", name: "Trello", icon: "📋" },
  { id: "zoom", name: "Zoom", icon: "📹" },
  { id: "box", name: "Box", icon: "📦" },
]

export function SignInProviders() {
  const [loading, setLoading] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const displayedProviders = showAll ? providers : providers.slice(0, 6)

  const handleSignIn = async (providerId: string) => {
    setLoading(providerId)
    try {
      await signIn(providerId, { callbackUrl: "/onboarding/create-account" })
    } catch (error) {
      console.error("Sign in error:", error)
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      {displayedProviders.map((provider) => (
        <Button
          key={provider.id}
          onClick={() => handleSignIn(provider.id)}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
        >
          <span className="text-xl">{provider.icon}</span>
          <span>
            {loading === provider.id ? "Signing in..." : `Sign in with ${provider.name}`}
          </span>
        </Button>
      ))}

      {!showAll && (
        <Button
          onClick={() => setShowAll(true)}
          variant="outline"
          className="w-full"
        >
          Show {providers.length - 6} more providers
        </Button>
      )}
    </div>
  )
}
