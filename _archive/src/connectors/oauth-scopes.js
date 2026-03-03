/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
"use strict";

/**
 * ═══ OAuth Scope Definitions — All Utility Connectors ═══
 *
 * Every reasonable service connector with utility value.
 * Each provider defines granular services with human-readable
 * labels, descriptions, icons, and raw OAuth scope strings.
 */

const PROVIDERS = {
    // ═══════════ Cloud & Identity ═══════════
    google: {
        id: "google", name: "Google", icon: "google", color: "#4285F4", category: "cloud",
        services: {
            gmail: { label: "Gmail", icon: "📧", description: "Read, organize, label, and manage email", scopes: ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.labels"] },
            calendar: { label: "Google Calendar", icon: "📅", description: "View and manage calendar events", scopes: ["https://www.googleapis.com/auth/calendar"] },
            drive: { label: "Google Drive", icon: "📁", description: "Access, organize, and manage files", scopes: ["https://www.googleapis.com/auth/drive"] },
            sheets: { label: "Google Sheets", icon: "📊", description: "Read and write spreadsheet data", scopes: ["https://www.googleapis.com/auth/spreadsheets"] },
            docs: { label: "Google Docs", icon: "📝", description: "Create and edit documents", scopes: ["https://www.googleapis.com/auth/documents"] },
            contacts: { label: "Contacts", icon: "👥", description: "Access and manage contacts", scopes: ["https://www.googleapis.com/auth/contacts"] },
            tasks: { label: "Google Tasks", icon: "✅", description: "Manage task lists and items", scopes: ["https://www.googleapis.com/auth/tasks"] },
            photos: { label: "Google Photos", icon: "📸", description: "Access and organize photos library", scopes: ["https://www.googleapis.com/auth/photoslibrary"] },
            youtube: { label: "YouTube", icon: "▶️", description: "Manage channels, upload videos, read analytics", scopes: ["https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/youtube.upload"] },
            meet: { label: "Google Meet", icon: "📹", description: "Schedule and manage video meetings", scopes: ["https://www.googleapis.com/auth/calendar"] },
            cloud: { label: "Google Cloud", icon: "☁️", description: "Manage GCP projects, deploy, and monitor", scopes: ["https://www.googleapis.com/auth/cloud-platform"], businessOnly: true },
            analytics: { label: "Google Analytics", icon: "📈", description: "View website and app analytics data", scopes: ["https://www.googleapis.com/auth/analytics.readonly"], businessOnly: true },
            ads: { label: "Google Ads", icon: "💰", description: "Manage ad campaigns and reporting", scopes: ["https://www.googleapis.com/auth/adwords"], businessOnly: true },
        },
    },
    github: {
        id: "github", name: "GitHub", icon: "github", color: "#24292e", category: "devtools",
        services: {
            repos: { label: "Repositories", icon: "📦", description: "Read, create, and push code", scopes: ["repo"] },
            actions: { label: "Actions / CI-CD", icon: "⚡", description: "Trigger and manage workflows", scopes: ["workflow"] },
            issues: { label: "Issues & PRs", icon: "📋", description: "Create, update, and manage issues and PRs", scopes: ["repo"] },
            packages: { label: "Packages", icon: "📦", description: "Read and publish packages", scopes: ["read:packages", "write:packages"] },
            gists: { label: "Gists", icon: "📄", description: "Create and manage code snippets", scopes: ["gist"] },
            orgs: { label: "Organizations", icon: "🏢", description: "Manage org settings, teams, members", scopes: ["admin:org", "read:org"], businessOnly: true },
            webhooks: { label: "Webhooks", icon: "🔗", description: "Manage repository webhooks", scopes: ["admin:repo_hook"] },
            pages: { label: "GitHub Pages", icon: "🌐", description: "Manage Pages deployments", scopes: ["repo"] },
        },
    },
    microsoft: {
        id: "microsoft", name: "Microsoft", icon: "microsoft", color: "#00a4ef", category: "cloud",
        services: {
            outlook: { label: "Outlook Mail", icon: "📧", description: "Read, organize, and manage email", scopes: ["Mail.ReadWrite"] },
            calendar: { label: "Outlook Calendar", icon: "📅", description: "View and manage calendar events", scopes: ["Calendars.ReadWrite"] },
            onedrive: { label: "OneDrive", icon: "📁", description: "Access and manage cloud files", scopes: ["Files.ReadWrite.All"] },
            teams: { label: "Teams", icon: "💬", description: "Send messages, manage channels", scopes: ["Chat.ReadWrite", "Team.ReadBasic.All"], businessOnly: true },
            todo: { label: "To Do", icon: "✅", description: "Manage tasks and lists", scopes: ["Tasks.ReadWrite"] },
            onenote: { label: "OneNote", icon: "📓", description: "Access and manage notebooks", scopes: ["Notes.ReadWrite.All"] },
            sharepoint: { label: "SharePoint", icon: "📚", description: "Access team sites and documents", scopes: ["Sites.ReadWrite.All"], businessOnly: true },
            azure: { label: "Azure Cloud", icon: "☁️", description: "Manage Azure subscriptions and resources", scopes: ["https://management.azure.com/.default"], businessOnly: true },
            powerbi: { label: "Power BI", icon: "📊", description: "Access dashboards and reports", scopes: ["https://analysis.windows.net/powerbi/api/.default"], businessOnly: true },
        },
    },

    // ═══════════ Social Media ═══════════
    facebook: {
        id: "facebook", name: "Facebook", icon: "facebook", color: "#1877f2", category: "social",
        services: {
            profile: { label: "Profile", icon: "👤", description: "Access public profile info", scopes: ["public_profile", "email"] },
            pages: { label: "Pages", icon: "📄", description: "Manage Facebook pages and posts", scopes: ["pages_manage_posts", "pages_read_engagement"], businessOnly: true },
            ads: { label: "Ads Manager", icon: "💰", description: "Manage ad campaigns and audiences", scopes: ["ads_management", "ads_read"], businessOnly: true },
            groups: { label: "Groups", icon: "👥", description: "Moderate and post in managed groups", scopes: ["groups_access_member_info", "publish_to_groups"], businessOnly: true },
        },
    },
    instagram: {
        id: "instagram", name: "Instagram", icon: "instagram", color: "#e1306c", category: "social",
        services: {
            feed: { label: "Feed & Posts", icon: "📸", description: "View and manage Instagram content", scopes: ["instagram_basic", "instagram_content_publish"] },
            insights: { label: "Analytics", icon: "📊", description: "View engagement metrics and audience data", scopes: ["instagram_manage_insights"], businessOnly: true },
            comments: { label: "Comments", icon: "💬", description: "Read and manage comments on posts", scopes: ["instagram_manage_comments"] },
        },
    },
    twitter: {
        id: "twitter", name: "X / Twitter", icon: "twitter", color: "#0f1419", category: "social",
        services: {
            posts: { label: "Posts & Timeline", icon: "📝", description: "Read timeline, create and manage posts", scopes: ["tweet.read", "tweet.write", "users.read"] },
            dm: { label: "Direct Messages", icon: "💌", description: "Read and send direct messages", scopes: ["dm.read", "dm.write"] },
            lists: { label: "Lists", icon: "📋", description: "Create and manage lists", scopes: ["list.read", "list.write"] },
            spaces: { label: "Spaces", icon: "🎙️", description: "Manage Twitter Spaces", scopes: ["space.read"] },
            analytics: { label: "Analytics", icon: "📈", description: "View tweet and account analytics", scopes: ["tweet.read", "users.read"] },
        },
    },
    linkedin: {
        id: "linkedin", name: "LinkedIn", icon: "linkedin", color: "#0a66c2", category: "social",
        services: {
            profile: { label: "Profile", icon: "👤", description: "Access your LinkedIn profile data", scopes: ["r_liteprofile", "r_emailaddress"] },
            posts: { label: "Posts", icon: "📝", description: "Create and manage LinkedIn posts", scopes: ["w_member_social"] },
            company: { label: "Company Page", icon: "🏢", description: "Manage your company page and posts", scopes: ["w_organization_social", "r_organization_social"], businessOnly: true },
            ads: { label: "Ads", icon: "💰", description: "Manage LinkedIn ad campaigns", scopes: ["r_ads", "w_ads"], businessOnly: true },
        },
    },
    tiktok: {
        id: "tiktok", name: "TikTok", icon: "tiktok", color: "#010101", category: "social",
        services: {
            videos: { label: "Videos", icon: "🎬", description: "Upload and manage TikTok videos", scopes: ["video.upload", "video.list"] },
            profile: { label: "Profile", icon: "👤", description: "Access creator profile info", scopes: ["user.info.basic"] },
            insights: { label: "Analytics", icon: "📊", description: "View video and account analytics", scopes: ["video.insights"], businessOnly: true },
        },
    },
    pinterest: {
        id: "pinterest", name: "Pinterest", icon: "pinterest", color: "#e60023", category: "social",
        services: {
            pins: { label: "Pins & Boards", icon: "📌", description: "Create and manage pins and boards", scopes: ["boards:read", "boards:write", "pins:read", "pins:write"] },
            analytics: { label: "Analytics", icon: "📊", description: "View pin and account analytics", scopes: ["user_accounts:read"], businessOnly: true },
        },
    },

    // ═══════════ Productivity & Collaboration ═══════════
    slack: {
        id: "slack", name: "Slack", icon: "slack", color: "#4a154b", category: "productivity",
        services: {
            messages: { label: "Messaging", icon: "💬", description: "Read and send messages in channels and DMs", scopes: ["chat:write", "channels:read", "channels:history", "im:write"] },
            channels: { label: "Channels", icon: "📢", description: "Create, archive, and manage channels", scopes: ["channels:manage", "groups:write"] },
            files: { label: "Files", icon: "📎", description: "Upload and manage shared files", scopes: ["files:write", "files:read"] },
            users: { label: "Users", icon: "👥", description: "View workspace members and profiles", scopes: ["users:read", "users:read.email"] },
            reactions: { label: "Reactions", icon: "😀", description: "Add and manage emoji reactions", scopes: ["reactions:write", "reactions:read"] },
            workflows: { label: "Workflows", icon: "⚙️", description: "Trigger and manage Slack workflows", scopes: ["workflow.steps:execute"], businessOnly: true },
        },
    },
    discord: {
        id: "discord", name: "Discord", icon: "discord", color: "#5865f2", category: "productivity",
        services: {
            messages: { label: "Messages", icon: "💬", description: "Read and send messages in servers", scopes: ["messages.read", "bot"] },
            guilds: { label: "Servers", icon: "🏠", description: "Manage server settings and roles", scopes: ["guilds", "guilds.members.read"] },
            voice: { label: "Voice", icon: "🎙️", description: "Join and manage voice channels", scopes: ["voice"] },
            webhooks: { label: "Webhooks", icon: "🔗", description: "Create and manage webhooks", scopes: ["webhook.incoming"] },
        },
    },
    notion: {
        id: "notion", name: "Notion", icon: "notion", color: "#000000", category: "productivity",
        services: {
            pages: { label: "Pages & Docs", icon: "📝", description: "Read, create, and edit Notion pages", scopes: ["read_content", "update_content", "insert_content"] },
            databases: { label: "Databases", icon: "🗃️", description: "Query and update Notion databases", scopes: ["read_content", "update_content"] },
            search: { label: "Search", icon: "🔍", description: "Search across your workspace", scopes: ["search"] },
            comments: { label: "Comments", icon: "💬", description: "Read and create comments", scopes: ["read_comments", "create_comments"] },
        },
    },
    asana: {
        id: "asana", name: "Asana", icon: "asana", color: "#f06a6a", category: "productivity",
        services: {
            tasks: { label: "Tasks", icon: "✅", description: "Create, update, and manage tasks", scopes: ["default"] },
            projects: { label: "Projects", icon: "📋", description: "Manage projects and sections", scopes: ["default"] },
            teams: { label: "Teams", icon: "👥", description: "View and manage team membership", scopes: ["default"], businessOnly: true },
        },
    },
    trello: {
        id: "trello", name: "Trello", icon: "trello", color: "#0052cc", category: "productivity",
        services: {
            boards: { label: "Boards", icon: "📋", description: "Create and manage Trello boards", scopes: ["read", "write"] },
            cards: { label: "Cards", icon: "🃏", description: "Create, move, and update cards", scopes: ["read", "write"] },
        },
    },
    zoom: {
        id: "zoom", name: "Zoom", icon: "zoom", color: "#2d8cff", category: "productivity",
        services: {
            meetings: { label: "Meetings", icon: "📹", description: "Schedule and manage Zoom meetings", scopes: ["meeting:write", "meeting:read"] },
            recordings: { label: "Recordings", icon: "🎥", description: "Access and manage cloud recordings", scopes: ["recording:read", "recording:write"] },
            webinars: { label: "Webinars", icon: "🎤", description: "Create and manage webinars", scopes: ["webinar:write", "webinar:read"], businessOnly: true },
            contacts: { label: "Contacts", icon: "👥", description: "Access Zoom contact list", scopes: ["contact:read"] },
        },
    },

    // ═══════════ Developer Tools ═══════════
    gitlab: {
        id: "gitlab", name: "GitLab", icon: "gitlab", color: "#fc6d26", category: "devtools",
        services: {
            repos: { label: "Repositories", icon: "📦", description: "Access and manage GitLab projects", scopes: ["api", "read_repository", "write_repository"] },
            ci: { label: "CI/CD", icon: "⚡", description: "Trigger and manage pipelines", scopes: ["api"] },
            issues: { label: "Issues", icon: "📋", description: "Create and manage issues and MRs", scopes: ["api"] },
            registry: { label: "Container Registry", icon: "🐳", description: "Push and pull container images", scopes: ["read_registry", "write_registry"] },
        },
    },
    bitbucket: {
        id: "bitbucket", name: "Bitbucket", icon: "bitbucket", color: "#0052cc", category: "devtools",
        services: {
            repos: { label: "Repositories", icon: "📦", description: "Access and manage repos", scopes: ["repository", "repository:write"] },
            pipelines: { label: "Pipelines", icon: "⚡", description: "Trigger and manage CI/CD", scopes: ["pipeline", "pipeline:write"] },
            pullreqs: { label: "Pull Requests", icon: "🔀", description: "Create and manage PRs", scopes: ["pullrequest", "pullrequest:write"] },
        },
    },
    jira: {
        id: "jira", name: "Jira", icon: "jira", color: "#0052cc", category: "devtools",
        services: {
            issues: { label: "Issues", icon: "📋", description: "Create, update, and transition issues", scopes: ["read:jira-work", "write:jira-work"] },
            boards: { label: "Boards", icon: "📊", description: "View and manage Kanban/Scrum boards", scopes: ["read:board-scope:jira-software"] },
            sprints: { label: "Sprints", icon: "🏃", description: "Manage sprint planning and backlog", scopes: ["read:sprint:jira-software", "write:sprint:jira-software"] },
            reports: { label: "Reports", icon: "📈", description: "Access velocity, burndown charts", scopes: ["read:jira-work"], businessOnly: true },
        },
    },
    vercel: {
        id: "vercel", name: "Vercel", icon: "vercel", color: "#000000", category: "devtools",
        services: {
            deployments: { label: "Deployments", icon: "🚀", description: "Deploy and manage Vercel projects", scopes: ["deployments"] },
            domains: { label: "Domains", icon: "🌐", description: "Manage custom domains", scopes: ["domains"] },
            env: { label: "Environment", icon: "⚙️", description: "Manage environment variables", scopes: ["env"] },
        },
    },
    netlify: {
        id: "netlify", name: "Netlify", icon: "netlify", color: "#00c7b7", category: "devtools",
        services: {
            sites: { label: "Sites", icon: "🌐", description: "Deploy and manage Netlify sites", scopes: ["default"] },
            forms: { label: "Forms", icon: "📝", description: "Access form submissions", scopes: ["default"] },
            functions: { label: "Functions", icon: "⚡", description: "Deploy serverless functions", scopes: ["default"] },
        },
    },
    digitalocean: {
        id: "digitalocean", name: "DigitalOcean", icon: "digitalocean", color: "#0080ff", category: "devtools",
        services: {
            droplets: { label: "Droplets", icon: "💧", description: "Manage virtual machines", scopes: ["read", "write"] },
            kubernetes: { label: "Kubernetes", icon: "☸️", description: "Manage Kubernetes clusters", scopes: ["read", "write"] },
            databases: { label: "Databases", icon: "🗄️", description: "Manage managed databases", scopes: ["read", "write"] },
            spaces: { label: "Spaces (S3)", icon: "📦", description: "Object storage management", scopes: ["read", "write"] },
        },
    },

    // ═══════════ Business & Commerce ═══════════
    salesforce: {
        id: "salesforce", name: "Salesforce", icon: "salesforce", color: "#00a1e0", category: "business",
        services: {
            crm: { label: "CRM", icon: "📊", description: "Manage contacts, leads, and opportunities", scopes: ["api", "refresh_token"] },
            reports: { label: "Reports", icon: "📈", description: "Access and run Salesforce reports", scopes: ["api"] },
            marketing: { label: "Marketing", icon: "📣", description: "Manage marketing campaigns", scopes: ["api"], businessOnly: true },
        },
    },
    hubspot: {
        id: "hubspot", name: "HubSpot", icon: "hubspot", color: "#ff7a59", category: "business",
        services: {
            contacts: { label: "Contacts", icon: "👥", description: "Manage CRM contacts and companies", scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"] },
            deals: { label: "Deals", icon: "💰", description: "Manage sales deals pipeline", scopes: ["crm.objects.deals.read", "crm.objects.deals.write"] },
            email: { label: "Email", icon: "📧", description: "Send marketing and transactional emails", scopes: ["content"], businessOnly: true },
            tickets: { label: "Tickets", icon: "🎫", description: "Manage support tickets", scopes: ["tickets"] },
        },
    },
    shopify: {
        id: "shopify", name: "Shopify", icon: "shopify", color: "#96bf48", category: "business",
        services: {
            products: { label: "Products", icon: "🛍️", description: "Manage product catalog and inventory", scopes: ["read_products", "write_products"] },
            orders: { label: "Orders", icon: "📦", description: "View and manage customer orders", scopes: ["read_orders", "write_orders"] },
            customers: { label: "Customers", icon: "👥", description: "Access customer data and segments", scopes: ["read_customers", "write_customers"] },
            analytics: { label: "Analytics", icon: "📈", description: "View store analytics and reports", scopes: ["read_analytics"] },
            themes: { label: "Themes", icon: "🎨", description: "Manage store themes and templates", scopes: ["read_themes", "write_themes"] },
        },
    },
    stripe: {
        id: "stripe", name: "Stripe", icon: "stripe", color: "#635bff", category: "business",
        services: {
            payments: { label: "Payments", icon: "💳", description: "View and manage payment intents", scopes: ["read_write"] },
            customers: { label: "Customers", icon: "👥", description: "Manage customer billing profiles", scopes: ["read_write"] },
            invoices: { label: "Invoices", icon: "🧾", description: "Create and manage invoices", scopes: ["read_write"] },
            subs: { label: "Subscriptions", icon: "🔄", description: "Manage recurring subscriptions", scopes: ["read_write"] },
            reports: { label: "Reports", icon: "📊", description: "Access financial reporting and analytics", scopes: ["read_only"] },
        },
    },
    quickbooks: {
        id: "quickbooks", name: "QuickBooks", icon: "quickbooks", color: "#2ca01c", category: "business",
        services: {
            accounting: { label: "Accounting", icon: "📒", description: "Manage invoices, expenses, and reconciliation", scopes: ["com.intuit.quickbooks.accounting"] },
            payments: { label: "Payments", icon: "💳", description: "Process and manage payments", scopes: ["com.intuit.quickbooks.payment"] },
            reports: { label: "Reports", icon: "📊", description: "Generate financial reports", scopes: ["com.intuit.quickbooks.accounting"] },
        },
    },
    mailchimp: {
        id: "mailchimp", name: "Mailchimp", icon: "mailchimp", color: "#ffe01b", category: "business",
        services: {
            lists: { label: "Audiences", icon: "👥", description: "Manage email lists and segments", scopes: ["default"] },
            campaigns: { label: "Campaigns", icon: "📣", description: "Create and send email campaigns", scopes: ["default"] },
            analytics: { label: "Analytics", icon: "📊", description: "View campaign performance stats", scopes: ["default"] },
            automations: { label: "Automations", icon: "⚙️", description: "Manage automated email workflows", scopes: ["default"] },
        },
    },

    // ═══════════ Storage & Media ═══════════
    dropbox: {
        id: "dropbox", name: "Dropbox", icon: "dropbox", color: "#0061ff", category: "storage",
        services: {
            files: { label: "Files", icon: "📁", description: "Access, upload, and organize files", scopes: ["files.content.write", "files.content.read", "files.metadata.read"] },
            sharing: { label: "Sharing", icon: "🔗", description: "Manage shared folders and links", scopes: ["sharing.write", "sharing.read"] },
            paper: { label: "Paper", icon: "📝", description: "Create and edit Dropbox Paper docs", scopes: ["files.content.write"] },
        },
    },
    box: {
        id: "box", name: "Box", icon: "box", color: "#0061d5", category: "storage",
        services: {
            files: { label: "Files", icon: "📁", description: "Access and manage files and folders", scopes: ["root_readwrite"] },
            collab: { label: "Collaboration", icon: "👥", description: "Manage collaborations on content", scopes: ["root_readwrite"], businessOnly: true },
        },
    },
    spotify: {
        id: "spotify", name: "Spotify", icon: "spotify", color: "#1db954", category: "media",
        services: {
            playback: { label: "Playback", icon: "🎵", description: "Control playback and view now-playing", scopes: ["user-modify-playback-state", "user-read-playback-state", "user-read-currently-playing"] },
            library: { label: "Library", icon: "📚", description: "Access saved tracks, albums, and playlists", scopes: ["user-library-read", "user-library-modify"] },
            playlists: { label: "Playlists", icon: "📋", description: "Create and manage playlists", scopes: ["playlist-modify-public", "playlist-modify-private", "playlist-read-private"] },
            stats: { label: "Listening Stats", icon: "📊", description: "View top artists, tracks, and history", scopes: ["user-top-read", "user-read-recently-played"] },
        },
    },

    // ═══════════ Communication ═══════════
    twilio: {
        id: "twilio", name: "Twilio", icon: "twilio", color: "#f22f46", category: "communication",
        services: {
            sms: { label: "SMS", icon: "💬", description: "Send and receive text messages", scopes: ["messages"] },
            voice: { label: "Voice", icon: "📞", description: "Make and manage phone calls", scopes: ["calls"] },
            whatsapp: { label: "WhatsApp", icon: "💚", description: "Send WhatsApp messages via Twilio", scopes: ["messages"] },
            verify: { label: "Verify", icon: "🔐", description: "Send verification codes", scopes: ["verify"] },
        },
    },
    sendgrid: {
        id: "sendgrid", name: "SendGrid", icon: "sendgrid", color: "#1a82e2", category: "communication",
        services: {
            email: { label: "Email", icon: "📧", description: "Send transactional and marketing email", scopes: ["mail.send"] },
            templates: { label: "Templates", icon: "📝", description: "Manage email templates", scopes: ["templates.read", "templates.write"] },
            contacts: { label: "Contacts", icon: "👥", description: "Manage email contacts and lists", scopes: ["marketing.contacts.read", "marketing.contacts.write"] },
        },
    },

    // ═══════════ Cloud Providers ═══════════
    amazon: {
        id: "amazon", name: "Amazon / AWS", icon: "amazon", color: "#ff9900", category: "cloud",
        services: {
            aws: { label: "AWS Cloud", icon: "☁️", description: "Manage EC2, S3, Lambda, RDS, and more", scopes: ["aws.cognito.signin.user.admin"], businessOnly: true },
            ses: { label: "AWS SES", icon: "📧", description: "Send email via Amazon SES", scopes: ["ses:SendEmail"], businessOnly: true },
            s3: { label: "S3 Storage", icon: "📦", description: "Manage S3 buckets and objects", scopes: ["s3:*"], businessOnly: true },
            profile: { label: "Amazon Profile", icon: "👤", description: "Access Amazon account info", scopes: ["profile"] },
        },
    },
    apple: {
        id: "apple", name: "Apple", icon: "apple", color: "#000000", category: "cloud",
        services: {
            signin: { label: "Apple ID", icon: "🍎", description: "Sign in with Apple ID", scopes: ["name", "email"] },
            musickit: { label: "Apple Music", icon: "🎵", description: "Access music library and playlists", scopes: ["music"] },
        },
    },
    cloudflare: {
        id: "cloudflare", name: "Cloudflare", icon: "cloudflare", color: "#f38020", category: "cloud",
        services: {
            dns: { label: "DNS", icon: "🌐", description: "Manage DNS records and zones", scopes: ["zone:read", "zone:edit", "dns_records:edit"] },
            workers: { label: "Workers", icon: "⚡", description: "Deploy and manage edge workers", scopes: ["worker:admin"] },
            pages: { label: "Pages", icon: "📄", description: "Manage Cloudflare Pages deployments", scopes: ["pages:admin"] },
            analytics: { label: "Analytics", icon: "📊", description: "View traffic and security analytics", scopes: ["analytics:read"] },
        },
    },

    // ═══════════ AI & Data ═══════════
    openai: {
        id: "openai", name: "OpenAI", icon: "openai", color: "#412991", category: "ai",
        services: {
            api: { label: "API Access", icon: "🤖", description: "Use GPT, DALL·E, Whisper models", scopes: ["api"] },
            assistants: { label: "Assistants", icon: "🧠", description: "Create and manage custom assistants", scopes: ["api"] },
            files: { label: "Files", icon: "📁", description: "Upload files for fine-tuning and retrieval", scopes: ["api"] },
        },
    },
    huggingface: {
        id: "huggingface", name: "Hugging Face", icon: "huggingface", color: "#ffd21e", category: "ai",
        services: {
            models: { label: "Models", icon: "🤖", description: "Access and deploy ML models", scopes: ["read-repos", "write-repos"] },
            spaces: { label: "Spaces", icon: "🚀", description: "Deploy and manage HF Spaces", scopes: ["manage-repos"] },
            datasets: { label: "Datasets", icon: "📊", description: "Access and manage datasets", scopes: ["read-repos", "write-repos"] },
            inference: { label: "Inference API", icon: "⚡", description: "Run serverless model inference", scopes: ["inference-api"] },
        },
    },
    airtable: {
        id: "airtable", name: "Airtable", icon: "airtable", color: "#18bfff", category: "ai",
        services: {
            bases: { label: "Bases", icon: "🗃️", description: "Read and write Airtable bases and records", scopes: ["data.records:read", "data.records:write", "schema.bases:read"] },
            automations: { label: "Automations", icon: "⚙️", description: "Trigger and manage automations", scopes: ["webhook:manage"] },
        },
    },

    // ═══════════ Support & CX ═══════════
    zendesk: {
        id: "zendesk", name: "Zendesk", icon: "zendesk", color: "#03363d", category: "business",
        services: {
            tickets: { label: "Tickets", icon: "🎫", description: "Create and manage support tickets", scopes: ["tickets:read", "tickets:write"] },
            users: { label: "Users", icon: "👥", description: "Manage end-user and agent profiles", scopes: ["users:read", "users:write"] },
            knowledge: { label: "Knowledge Base", icon: "📚", description: "Manage help center articles", scopes: ["hc:read", "hc:write"] },
        },
    },
    intercom: {
        id: "intercom", name: "Intercom", icon: "intercom", color: "#1f8ded", category: "business",
        services: {
            conversations: { label: "Conversations", icon: "💬", description: "Read and reply to conversations", scopes: ["conversations:read", "conversations:write"] },
            contacts: { label: "Contacts", icon: "👥", description: "Manage leads and users", scopes: ["contacts:read", "contacts:write"] },
            articles: { label: "Articles", icon: "📝", description: "Manage help center articles", scopes: ["articles:read", "articles:write"] },
        },
    },

    // ═══════════ Finance ═══════════
    plaid: {
        id: "plaid", name: "Plaid", icon: "plaid", color: "#0a85ea", category: "finance",
        services: {
            accounts: { label: "Bank Accounts", icon: "🏦", description: "Link and view bank account info", scopes: ["accounts", "transactions"] },
            transactions: { label: "Transactions", icon: "💸", description: "View transaction history", scopes: ["transactions"] },
            identity: { label: "Identity", icon: "🪪", description: "Verify account holder identity", scopes: ["identity"] },
        },
    },
};

function getScopesForServices(providerId, serviceIds) {
    const provider = PROVIDERS[providerId];
    if (!provider) return [];
    const scopes = new Set();
    for (const svcId of serviceIds) {
        const svc = provider.services[svcId];
        if (svc) svc.scopes.forEach((s) => scopes.add(s));
    }
    return Array.from(scopes);
}

function listServices(providerId, opts = {}) {
    const provider = PROVIDERS[providerId];
    if (!provider) return [];
    return Object.entries(provider.services)
        .filter(([, svc]) => opts.businessMode || !svc.businessOnly)
        .map(([id, svc]) => ({ id, label: svc.label, description: svc.description, icon: svc.icon, businessOnly: !!svc.businessOnly, scopeCount: svc.scopes.length }));
}

function listProviders(opts = {}) {
    const providers = Object.values(PROVIDERS).map((p) => ({
        id: p.id, name: p.name, icon: p.icon, color: p.color, category: p.category,
        serviceCount: Object.keys(p.services).length,
    }));
    if (opts.category) return providers.filter((p) => p.category === opts.category);
    return providers;
}

function listCategories() {
    const cats = new Set(Object.values(PROVIDERS).map((p) => p.category));
    return Array.from(cats).map((c) => ({ id: c, label: c.charAt(0).toUpperCase() + c.slice(1), providerCount: Object.values(PROVIDERS).filter((p) => p.category === c).length }));
}

module.exports = { PROVIDERS, getScopesForServices, listServices, listProviders, listCategories };
