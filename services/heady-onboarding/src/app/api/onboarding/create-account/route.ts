import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import crypto from "crypto"

const createAccountSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be less than 30 characters")
    .regex(/^[a-z0-9_-]+$/, "Username can only contain lowercase letters, numbers, hyphens and underscores"),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { username } = createAccountSchema.parse(body)

    const existing = await prisma.user.findUnique({
      where: { headyUsername: username }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      )
    }

    const apiKey = `heady_${crypto.randomBytes(32).toString("hex")}`

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        headyUsername: username,
        headyEmail: `${username}@headyme.com`,
        apiKey: apiKey,
        apiKeyCreatedAt: new Date(),
        onboardingStep: 1,
      }
    })

    await prisma.onboardingLog.create({
      data: {
        userId: session.user.id,
        step: 1,
        action: "create_account",
        metadata: { username, timestamp: new Date().toISOString() }
      }
    })

    return NextResponse.json({
      success: true,
      headyUsername: username,
      headyEmail: `${username}@headyme.com`,
      nextStep: "/onboarding/email-config"
    })

  } catch (error) {
    console.error("Create account error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
