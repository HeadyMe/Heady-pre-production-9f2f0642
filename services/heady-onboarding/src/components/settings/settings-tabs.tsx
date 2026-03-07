"use client"

import { useState } from "react"

interface User {
  id: string
  email?: string | null
  headyEmail?: string | null
  headyUsername?: string | null
  permissionMode?: string | null
  apiKey?: string | null
}

interface SettingsTabsProps {
  user: User
}

export function SettingsTabs({ user }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState("account")

  const tabs = [
    { id: "account", label: "Account" },
    { id: "email", label: "Email" },
    { id: "permissions", label: "Permissions" },
    { id: "api", label: "API Keys" },
    { id: "buddy", label: "HeadyBuddy" }
  ]

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg">
      <div className="border-b border-slate-800">
        <div className="flex space-x-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-heady-primary text-white"
                  : "text-heady-muted hover:text-heady-foreground hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === "account" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-heady-foreground">Account Settings</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-heady-muted">Email</label>
                <p className="text-heady-foreground font-mono">{user.email}</p>
              </div>
              <div>
                <label className="text-sm text-heady-muted">HeadyMe Username</label>
                <p className="text-heady-foreground font-mono">{user.headyUsername}</p>
              </div>
              <div>
                <label className="text-sm text-heady-muted">HeadyMe Email</label>
                <p className="text-heady-foreground font-mono">{user.headyEmail}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "email" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-heady-foreground">Email Configuration</h2>
            <p className="text-heady-muted">Manage your @headyme.com email forwarding and client settings.</p>
          </div>
        )}

        {activeTab === "permissions" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-heady-foreground">Permissions</h2>
            <div>
              <label className="text-sm text-heady-muted">Current Mode</label>
              <p className="text-heady-foreground capitalize">{user.permissionMode}</p>
            </div>
          </div>
        )}

        {activeTab === "api" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-heady-foreground">API Keys</h2>
            <div className="bg-slate-950 border border-slate-700 rounded p-4 font-mono text-sm break-all">
              {user.apiKey}
            </div>
          </div>
        )}

        {activeTab === "buddy" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-heady-foreground">HeadyBuddy Settings</h2>
            <p className="text-heady-muted">Customize your AI companion and context switcher.</p>
          </div>
        )}
      </div>
    </div>
  )
}
