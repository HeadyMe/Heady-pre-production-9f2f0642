import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const buddyConfigSchema = z.object({
  customUIs: z.array(z.object({
    id: z.string(),
    name: z.string(),
    config: z.record(z.any())
  })),
  contexts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    active: z.boolean()
  })),
  preferences: z.record(z.any())
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const config = buddyConfigSchema.parse(body)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        buddyConfig: config,
        buddySetupComplete: true,
        onboardingStep: 4,
      }
    })

    await prisma.onboardingLog.create({
      data: {
        userId: session.user.id,
        step: 4,
        action: "buddy_setup",
        metadata: { 
          uiCount: config.customUIs.length,
          contextCount: config.contexts.length,
          timestamp: new Date().toISOString() 
        }
      }
    })

    return NextResponse.json({
      success: true,
      nextStep: "/onboarding/complete"
    })

  } catch (error) {
    console.error("Buddy setup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
