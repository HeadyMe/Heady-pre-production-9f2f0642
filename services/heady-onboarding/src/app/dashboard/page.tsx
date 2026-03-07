import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DashboardHeader } from "@/components/dashboard/header"
import { ApiKeyCard } from "@/components/dashboard/api-key-card"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { SystemStatus } from "@/components/dashboard/system-status"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (!session.user.onboardingComplete) {
    redirect("/onboarding/create-account")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      _count: {
        select: {
          sessions: true
        }
      }
    }
  })

  const recentActivity = await prisma.onboardingLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10
  })

  const apiUsage = await prisma.apiKeyUsage.count({
    where: { 
      userId: session.user.id,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24h
      }
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-heady-background via-slate-900 to-heady-background">
      <DashboardHeader user={user!} />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Welcome Card */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-heady-foreground mb-2">
                Welcome back, {user?.name || user?.headyUsername}! 🚀
              </h2>
              <p className="text-heady-muted">
                Your HeadyMe pilot environment is ready. Let\'s build something amazing.
              </p>
            </div>

            {/* Quick Actions */}
            <QuickActions 
              headyEmail={user?.headyEmail!}
              permissionMode={user?.permissionMode!}
              hasEmailClient={user?.hasEmailClient!}
            />

            {/* Recent Activity */}
            <RecentActivity activities={recentActivity} />
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* API Key Card */}
            <ApiKeyCard apiKey={user?.apiKey!} />

            {/* System Status */}
            <SystemStatus 
              apiUsage24h={apiUsage}
              activeSessions={user?._count.sessions || 0}
            />

            {/* Account Info */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-heady-foreground mb-4">
                Account Details
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-heady-muted">Email</p>
                  <p className="text-heady-foreground font-mono">{user?.headyEmail}</p>
                </div>
                <div>
                  <p className="text-heady-muted">Username</p>
                  <p className="text-heady-foreground font-mono">{user?.headyUsername}</p>
                </div>
                <div>
                  <p className="text-heady-muted">Mode</p>
                  <p className="text-heady-foreground capitalize">{user?.permissionMode}</p>
                </div>
                <div>
                  <p className="text-heady-muted">Member Since</p>
                  <p className="text-heady-foreground">
                    {new Date(user?.createdAt!).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
