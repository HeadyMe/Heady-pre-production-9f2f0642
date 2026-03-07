import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const permissionsSchema = z.object({
  mode: z.enum(["cloud", "hybrid"]),
  filesystemAccess: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const config = permissionsSchema.parse(body)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        permissionMode: config.mode,
        filesystemAccess: config.mode === "hybrid" ? (config.filesystemAccess ?? true) : false,
        onboardingStep: 3,
      }
    })

    await prisma.onboardingLog.create({
      data: {
        userId: session.user.id,
        step: 3,
        action: "permissions_set",
        metadata: { mode: config.mode, timestamp: new Date().toISOString() }
      }
    })

    return NextResponse.json({
      success: true,
      nextStep: "/onboarding/buddy"
    })

  } catch (error) {
    console.error("Permissions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
