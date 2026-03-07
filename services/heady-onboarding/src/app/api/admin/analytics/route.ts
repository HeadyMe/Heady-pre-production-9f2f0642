import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Total users
    const totalUsers = await prisma.user.count()

    // Completed onboarding
    const completedOnboarding = await prisma.user.count({
      where: { onboardingComplete: true }
    })

    // Step completion breakdown
    const stepBreakdown = await prisma.user.groupBy({
      by: ["onboardingStep"],
      _count: true
    })

    // API usage last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const apiUsage = await prisma.apiKeyUsage.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    })

    // Average time to complete onboarding
    const completionTimes = await prisma.$queryRaw`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (MAX("createdAt") - MIN("createdAt")))) as avg_seconds
      FROM "OnboardingLog"
      WHERE "userId" IN (
        SELECT "userId" FROM "OnboardingLog" WHERE step = 5
      )
      GROUP BY "userId"
    `

    return NextResponse.json({
      overview: {
        totalUsers,
        completedOnboarding,
        completionRate: ((completedOnboarding / totalUsers) * 100).toFixed(1),
        apiUsage7d: apiUsage
      },
      stepBreakdown,
      avgCompletionTime: completionTimes[0]?.avg_seconds || 0
    })

  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
