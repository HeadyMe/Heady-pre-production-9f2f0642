import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import type { NextAuthConfig } from "next-auth"

// Import all providers
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Microsoft from "next-auth/providers/microsoft"
import Apple from "next-auth/providers/apple"
import Discord from "next-auth/providers/discord"
import Twitter from "next-auth/providers/twitter"
import LinkedIn from "next-auth/providers/linkedin"
import Auth0 from "next-auth/providers/auth0"
import Okta from "next-auth/providers/okta"
import Slack from "next-auth/providers/slack"
import Spotify from "next-auth/providers/spotify"
import GitLab from "next-auth/providers/gitlab"
import Bitbucket from "next-auth/providers/bitbucket"
import Facebook from "next-auth/providers/facebook"
import Reddit from "next-auth/providers/reddit"
import Twitch from "next-auth/providers/twitch"
import Dropbox from "next-auth/providers/dropbox"
import Atlassian from "next-auth/providers/atlassian"
import Keycloak from "next-auth/providers/keycloak"
import Azure from "next-auth/providers/azure-ad"
import Salesforce from "next-auth/providers/salesforce"
import Notion from "next-auth/providers/notion"
import Trello from "next-auth/providers/trello"
import Zoom from "next-auth/providers/zoom"
import Box from "next-auth/providers/box"

// Custom HuggingFace provider
const HuggingFace = {
  id: "huggingface",
  name: "Hugging Face",
  type: "oauth" as const,
  clientId: process.env.HUGGINGFACE_ID,
  clientSecret: process.env.HUGGINGFACE_SECRET,
  authorization: {
    url: "https://huggingface.co/oauth/authorize",
    params: { scope: "profile email" }
  },
  token: "https://huggingface.co/oauth/token",
  userinfo: "https://huggingface.co/api/whoami-v2",
  profile(profile: any) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: profile.picture,
    }
  },
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    HuggingFace,
    Microsoft({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    }),
    Apple({
      clientId: process.env.APPLE_ID!,
      clientSecret: process.env.APPLE_SECRET!,
    }),
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    }),
    LinkedIn({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
    Auth0({
      clientId: process.env.AUTH0_CLIENT_ID!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET!,
      issuer: process.env.AUTH0_ISSUER!,
    }),
    Okta({
      clientId: process.env.OKTA_CLIENT_ID!,
      clientSecret: process.env.OKTA_CLIENT_SECRET!,
      issuer: process.env.OKTA_ISSUER!,
    }),
    Slack({ clientId: process.env.SLACK_CLIENT_ID!, clientSecret: process.env.SLACK_CLIENT_SECRET! }),
    Spotify({ clientId: process.env.SPOTIFY_CLIENT_ID!, clientSecret: process.env.SPOTIFY_CLIENT_SECRET! }),
    GitLab({ clientId: process.env.GITLAB_ID!, clientSecret: process.env.GITLAB_SECRET! }),
    Bitbucket({ clientId: process.env.BITBUCKET_ID!, clientSecret: process.env.BITBUCKET_SECRET! }),
    Facebook({ clientId: process.env.FACEBOOK_ID!, clientSecret: process.env.FACEBOOK_SECRET! }),
    Reddit({ clientId: process.env.REDDIT_ID!, clientSecret: process.env.REDDIT_SECRET! }),
    Twitch({ clientId: process.env.TWITCH_ID!, clientSecret: process.env.TWITCH_SECRET! }),
    Dropbox({ clientId: process.env.DROPBOX_ID!, clientSecret: process.env.DROPBOX_SECRET! }),
    Atlassian({ clientId: process.env.ATLASSIAN_ID!, clientSecret: process.env.ATLASSIAN_SECRET! }),
    Keycloak({ clientId: process.env.KEYCLOAK_ID!, clientSecret: process.env.KEYCLOAK_SECRET!, issuer: process.env.KEYCLOAK_ISSUER! }),
    Azure({ clientId: process.env.AZURE_AD_CLIENT_ID!, clientSecret: process.env.AZURE_AD_CLIENT_SECRET!, tenantId: process.env.AZURE_AD_TENANT_ID! }),
    Salesforce({ clientId: process.env.SALESFORCE_ID!, clientSecret: process.env.SALESFORCE_SECRET! }),
    Notion({ clientId: process.env.NOTION_ID!, clientSecret: process.env.NOTION_SECRET! }),
    Trello({ clientId: process.env.TRELLO_ID!, clientSecret: process.env.TRELLO_SECRET! }),
    Zoom({ clientId: process.env.ZOOM_CLIENT_ID!, clientSecret: process.env.ZOOM_CLIENT_SECRET! }),
    Box({ clientId: process.env.BOX_CLIENT_ID!, clientSecret: process.env.BOX_CLIENT_SECRET! }),
    // Add more providers as needed - Auth.js supports 80+
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow sign in
      return true
    },
    async redirect({ url, baseUrl }) {
      // Check if user needs onboarding
      const session = await auth()
      if (session?.user?.id) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { onboardingComplete: true, onboardingStep: true }
        })

        if (!user?.onboardingComplete) {
          // Redirect to appropriate onboarding step
          const stepRoutes = [
            "/onboarding/create-account",
            "/onboarding/email-config",
            "/onboarding/permissions",
            "/onboarding/buddy"
          ]
          return stepRoutes[user?.onboardingStep || 0] || "/onboarding/create-account"
        }
      }

      // Default redirect to dashboard
      return url.startsWith(baseUrl) ? url : baseUrl + "/dashboard"
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        session.user.onboardingComplete = user.onboardingComplete
        session.user.onboardingStep = user.onboardingStep
        session.user.headyUsername = user.headyUsername
        session.user.headyEmail = user.headyEmail
        session.user.apiKey = user.apiKey
      }
      return session
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      if (isNewUser) {
        // Log new user signup
        await prisma.onboardingLog.create({
          data: {
            userId: user.id!,
            step: 0,
            action: "signup",
            metadata: {
              provider: account?.provider,
              timestamp: new Date().toISOString()
            }
          }
        })
      }
    }
  }
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
