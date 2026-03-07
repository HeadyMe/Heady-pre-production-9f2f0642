import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      onboardingComplete: boolean
      onboardingStep: number
      headyUsername?: string
      headyEmail?: string
      apiKey?: string
    } & DefaultSession["user"]
  }

  interface User {
    onboardingComplete: boolean
    onboardingStep: number
    headyUsername?: string
    headyEmail?: string
    apiKey?: string
  }
}

export interface OnboardingState {
  currentStep: number
  completed: boolean
  accountCreated: boolean
  emailConfigured: boolean
  permissionsSet: boolean
  buddySetup: boolean
}

export interface EmailConfig {
  provider: "client" | "forward"
  forwardTo?: string
}

export interface PermissionsConfig {
  mode: "cloud" | "hybrid"
  filesystemAccess: boolean
}

export interface BuddyConfig {
  customUIs: Array<{
    id: string
    name: string
    config: Record<string, any>
  }>
  contexts: Array<{
    id: string
    name: string
    active: boolean
  }>
  preferences: Record<string, any>
}
