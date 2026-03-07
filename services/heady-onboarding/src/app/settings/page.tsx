import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DashboardHeader } from "@/components/dashboard/header"
import { SettingsTabs } from "@/components/settings/settings-tabs"

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-heady-background via-slate-900 to-heady-background">
      <DashboardHeader user={user!} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-heady-foreground mb-8">
            Settings
          </h1>
          <SettingsTabs user={user!} />
        </div>
      </main>
    </div>
  )
}
