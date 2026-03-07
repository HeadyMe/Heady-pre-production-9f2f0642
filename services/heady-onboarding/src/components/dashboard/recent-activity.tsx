"use client"

interface Activity {
  step: number
  action: string
  createdAt: Date
  metadata?: any
}

interface RecentActivityProps {
  activities: Activity[]
}

const stepNames: Record<number, string> = {
  0: "Signed up",
  1: "Created account",
  2: "Configured email",
  3: "Set permissions",
  4: "Setup HeadyBuddy",
  5: "Completed onboarding"
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-heady-foreground mb-4">
        Recent Activity
      </h3>

      {activities.length === 0 ? (
        <p className="text-heady-muted text-sm">No recent activity</p>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 5).map((activity, idx) => (
            <div 
              key={idx}
              className="flex items-start space-x-3 pb-3 border-b border-slate-800 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-heady-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-heady-primary text-xs">
                  {activity.step}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-heady-foreground">
                  {stepNames[activity.step] || activity.action}
                </p>
                <p className="text-xs text-heady-muted">
                  {new Date(activity.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
