# Local Development Setup

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB Atlas (free tier) or MongoDB installed locally
- Google Cloud Console project with OAuth 2.0 credentials
- Anthropic API key

## 1. Clone & Install

```bash
git clone <repo-url>
cd resume-maker
npm install
```

## 2. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the values:

```env
# MongoDB connection string (Atlas or local)
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/resumemaker?retryWrites=true&w=majority"
# Local alternative:
# DATABASE_URL="mongodb://localhost:27017/resumemaker"

# NextAuth.js
AUTH_SECRET="generate-with: openssl rand -base64 32"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
NEXTAUTH_URL="http://localhost:3000"

# Anthropic
ANTHROPIC_API_KEY="sk-ant-..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "Google OAuth 2.0" under APIs & Services → Library
4. Go to APIs & Services → Credentials → Create Credentials → OAuth Client ID
5. Application type: **Web application**
6. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Client Secret to `.env.local`

## 4. Database Setup

Mongoose handles schema creation automatically when the app first connects. No manual migration needed.

To view your data, use:
- **MongoDB Compass** (free GUI): connect with your `DATABASE_URL`
- **MongoDB Atlas UI**: built into the Atlas dashboard if using cloud
- Or run `mongosh` for a CLI shell

## 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 6. Development Workflow

### Adding Shadcn/UI Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
# etc.
```

### Schema Changes

Mongoose schemas live in `src/lib/models/`. Just edit the schema file — changes take effect on next server start. No migration commands needed.

## Project Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
