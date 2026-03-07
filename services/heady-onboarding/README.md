# HeadyMe Pilot - Authentication & Onboarding System

Complete authentication and onboarding system for HeadyMe pilot testing with 25+ OAuth providers, email configuration, permissions, and HeadyBuddy setup.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- PostgreSQL database
- Auth provider credentials (Google, GitHub, HuggingFace, etc.)

### Installation

1. **Clone or extract this package**
```bash
cd heady_pilot_onboarding_complete
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```

Edit .env and add your Database URL, NextAuth secret, and OAuth provider credentials.

4. **Setup database**
```bash
npx prisma generate
npx prisma db push
```

5. **Run development server**
```bash
npm run dev
```

Visit http://localhost:3000

## 📋 Features

### Authentication
- 25+ OAuth Providers
- Secure Sessions with Auth.js v5
- Auto-redirect middleware

### 5-Stage Onboarding Flow

**Stage 1 - Create Account**
- Username selection
- Auto-generates @headyme.com email
- Creates secure API key

**Stage 2 - Email Configuration**
- Heady email client OR forward to existing email
- Cloudflare Email Routing integration ready

**Stage 3 - Permissions**
- Cloud-only OR hybrid mode
- HeadyCloud integration hooks

**Stage 4 - HeadyBuddy Setup**
- Create custom UI workspaces
- Configure context switcher

**Stage 5 - Complete**
- Marks onboarding complete
- Redirects to dashboard

## 🏗️ Project Structure

All source files organized in src/ with:
- app/(auth)/login - Login with 25+ providers
- app/onboarding/* - 4 onboarding steps
- app/api/onboarding/* - API routes
- components/auth - Provider buttons
- lib/auth/config.ts - Auth.js configuration
- middleware.ts - Route protection

## 🔧 Configuration

### Adding OAuth Providers

1. Add credentials to .env
2. Import provider in src/lib/auth/config.ts
3. Add button in components/auth/sign-in-providers.tsx

### Integration Points

**HeadyCloud**: Permissions step
**HeadyMCP**: API key at create-account
**HeadyBuddy**: Configuration in buddy step

## 🔒 Security

- Crypto-secure API keys
- CSRF protection
- Secure httpOnly cookies
- SQL injection protected via Prisma

## 📊 Analytics

OnboardingLog table tracks completions and drop-off points.

## 📝 License

Proprietary - HeadySystems Inc.

## 🆘 Support

- GitHub: https://github.com/HeadyMe
- Email: eric@headyconnection.org
- Docs: https://headyio.com

Built with Next.js 14, Auth.js v5, Prisma, TypeScript, Tailwind CSS
