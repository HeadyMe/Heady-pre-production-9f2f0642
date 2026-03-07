import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        headyUsername: true,
        headyEmail: true,
        onboardingComplete: true,
        onboardingStep: true,
        permissionMode: true,
        createdAt: true,
        _count: {
          select: {
            sessions: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json({ users, total: users.length })

  } catch (error) {
    console.error("Admin users list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
