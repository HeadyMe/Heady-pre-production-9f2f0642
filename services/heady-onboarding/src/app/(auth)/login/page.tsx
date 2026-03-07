import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignInProviders } from "@/components/auth/sign-in-providers"

export const metadata: Metadata = {
  title: "Sign In | HeadyMe",
  description: "Sign in to your HeadyMe account",
}

export default async function LoginPage() {
  const session = await auth()

  if (session?.user) {
    if (!session.user.onboardingComplete) {
      redirect("/onboarding/create-account")
    }
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-heady-background via-slate-900 to-heady-background">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-heady-foreground mb-2">
            Welcome to Heady
          </h1>
          <p className="text-heady-muted">
            Sign in to access your command center
          </p>
        </div>

        <SignInProviders />

        <div className="mt-8 text-center text-sm text-heady-muted">
          Don\'t have an account?{" "}
          <a href="/signup" className="text-heady-primary hover:underline">
            Sign up
          </a>
        </div>
      </div>
    </div>
  )
}
