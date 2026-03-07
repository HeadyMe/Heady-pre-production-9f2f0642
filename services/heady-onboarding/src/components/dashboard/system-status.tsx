"use client"

interface SystemStatusProps {
  apiUsage24h: number
  activeSessions: number
}

export function SystemStatus({ apiUsage24h, activeSessions }: SystemStatusProps) {
  const services = [
    { name: "HeadyMCP", status: "operational", url: "https://headymcp.com" },
    { name: "HeadyCloud", status: "operational", url: "https://headycloud.com" },
    { name: "HeadyBuddy", status: "operational", url: "https://headybuddy.org" },
    { name: "HeadyIO", status: "operational", url: "https://headyio.com" }
  ]

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-heady-foreground mb-4">
        System Status
      </h3>

      <div className="space-y-3 mb-4">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between">
            <span className="text-sm text-heady-foreground">{service.name}</span>
            <span className="flex items-center text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              <span className="text-green-400">Online</span>
            </span>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-heady-muted">API Calls (24h)</span>
          <span className="text-heady-foreground font-semibold">{apiUsage24h}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-heady-muted">Active Sessions</span>
          <span className="text-heady-foreground font-semibold">{activeSessions}</span>
        </div>
      </div>
    </div>
  )
}
