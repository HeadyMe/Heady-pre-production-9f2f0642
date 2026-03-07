"use client"

import Link from "next/link"

interface QuickActionsProps {
  headyEmail: string
  permissionMode: string
  hasEmailClient: boolean
}

export function QuickActions({ headyEmail, permissionMode, hasEmailClient }: QuickActionsProps) {
  const actions = [
    {
      icon: "🤖",
      title: "HeadyBuddy",
      description: "Launch your AI companion",
      href: "https://headybuddy.org",
      external: true
    },
    {
      icon: "🔌",
      title: "HeadyMCP",
      description: "Connect your IDE",
      href: "https://headymcp.com",
      external: true
    },
    {
      icon: "☁️",
      title: "HeadyCloud",
      description: `${permissionMode === "hybrid" ? "Hybrid" : "Cloud"} workspace`,
      href: "https://headycloud.com",
      external: true
    },
    {
      icon: "📧",
      title: "Email",
      description: hasEmailClient ? "Open Heady Mail" : `Forward to ${headyEmail}`,
      href: hasEmailClient ? "/mail" : "https://mail.google.com",
      external: !hasEmailClient
    },
    {
      icon: "📚",
      title: "Documentation",
      description: "API guides & tutorials",
      href: "https://headyio.com",
      external: true
    },
    {
      icon: "⚙️",
      title: "Settings",
      description: "Manage your account",
      href: "/settings",
      external: false
    }
  ]

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-heady-foreground mb-4">
        Quick Actions
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            target={action.external ? "_blank" : undefined}
            rel={action.external ? "noopener noreferrer" : undefined}
            className="p-4 border border-slate-700 rounded-lg hover:border-heady-primary hover:bg-heady-primary/5 transition-all group"
          >
            <div className="text-3xl mb-2">{action.icon}</div>
            <h4 className="font-semibold text-heady-foreground text-sm mb-1 group-hover:text-heady-primary">
              {action.title}
            </h4>
            <p className="text-xs text-heady-muted">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
