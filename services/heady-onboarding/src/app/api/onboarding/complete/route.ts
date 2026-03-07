import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        onboardingComplete: true,
        onboardingStep: 5,
      }
    })

    await prisma.onboardingLog.create({
      data: {
        userId: session.user.id,
        step: 5,
        action: "onboarding_complete",
        metadata: { timestamp: new Date().toISOString() }
      }
    })

    return NextResponse.json({
      success: true,
      redirect: "/dashboard"
    })

  } catch (error) {
    console.error("Complete onboarding error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
