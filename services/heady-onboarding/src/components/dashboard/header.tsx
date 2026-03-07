"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface DashboardHeaderProps {
  user: {
    name?: string | null
    headyUsername?: string | null
    image?: string | null
  }
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/dashboard" className="text-2xl font-bold text-heady-primary">
            Heady
          </Link>
          <nav className="hidden md:flex space-x-4">
            <Link href="/dashboard" className="text-heady-foreground hover:text-heady-primary">
              Dashboard
            </Link>
            <Link href="/projects" className="text-heady-muted hover:text-heady-primary">
              Projects
            </Link>
            <Link href="/docs" className="text-heady-muted hover:text-heady-primary">
              Docs
            </Link>
            <Link href="/settings" className="text-heady-muted hover:text-heady-primary">
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:block text-right">
            <p className="text-sm text-heady-foreground">{user.name || user.headyUsername}</p>
            <p className="text-xs text-heady-muted">Pilot User</p>
          </div>
          {user.image && (
            <img 
              src={user.image} 
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-heady-primary"
            />
          )}
          <Button 
            onClick={() => signOut({ callbackUrl: "/" })}
            variant="outline"
            className="text-sm"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  )
}
