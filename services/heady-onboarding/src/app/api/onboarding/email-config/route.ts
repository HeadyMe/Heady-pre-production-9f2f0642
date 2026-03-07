import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const emailConfigSchema = z.object({
  provider: z.enum(["client", "forward"]),
  forwardTo: z.string().email().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const config = emailConfigSchema.parse(body)

    if (config.provider === "forward" && !config.forwardTo) {
      return NextResponse.json(
        { error: "Forward email address is required" },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        emailSetup: config,
        hasEmailClient: config.provider === "client",
        onboardingStep: 2,
      }
    })

    await prisma.onboardingLog.create({
      data: {
        userId: session.user.id,
        step: 2,
        action: "email_config",
        metadata: { provider: config.provider, timestamp: new Date().toISOString() }
      }
    })

    return NextResponse.json({
      success: true,
      nextStep: "/onboarding/permissions"
    })

  } catch (error) {
    console.error("Email config error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
