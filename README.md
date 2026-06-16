# klipio.io

**Social Media Video Downloader + AI Content Understanding Platform**

> Paste a link. Download your video. Or let AI extract recipes, destinations, brands, and key insights.

---

## Quick Start (5 Minutes to Running)

### Step 1: Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/klipio.git
cd klipio
npm install
```

### Step 2: Environment Variables
```bash
cp .env.example .env.local
# Edit .env.local with your real API keys
```

### Step 3: Start Dev Server
```bash
npm run dev
# Open http://localhost:3000
```

---

## Complete Deployment Guide

### Prerequisites Checklist

| Service | You Need | Status |
|---------|----------|--------|
| **Domain** | klipio.io (registered at Dynadot) | ✅ Registered |
| **Vercel** | Account + project | ✅ You have |
| **Supabase** | Project + API keys | ✅ You have |
| **Cloudflare** | Account + API token | ✅ You have |
| **Cloudways** | Server IP + SSH key | ✅ You have |
| **Stripe** | Account (for payments) | ✅ You have |
| **OpenRouter** | API key | ⬜ Get below |
| **Deepgram** | API key | ⬜ Get below |
| **Proxies** | Residential proxy URL | ⬜ Get below |

---

### 1. Get Missing API Keys (Do This First)

#### OpenRouter (Required for AI)
1. Go to https://openrouter.ai/keys
2. Create new key
3. Add payment method (pay-as-you-go)
4. Copy key: `sk-or-v1-...`

#### Deepgram (Required for Transcription)
1. Go to https://console.deepgram.com/signup
2. Sign up (free $200 credits)
3. Create API key
4. Copy key

#### Residential Proxies (Required for Social Media Scraping)
**Option A - Decodo (Recommended):**
1. Go to https://decodo.com/ (formerly Smartproxy)
2. Sign up → Residential Proxies plan ($50-150/mo)
3. Copy proxy URL: `http://user:pass@gate.decodo.com:10000`

**Option B - Webshare (Cheaper):**
1. Go to https://www.webshare.io/
2. Sign up → Proxy plan ($4.99-27.99/mo)
3. Copy proxy credentials

---

### 2. Configure Supabase

1. Go to https://supabase.com/dashboard
2. Create new project (or use existing)
3. Go to Project Settings → API
4. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`
5. Go to SQL Editor → New query
6. Paste contents of `/supabase/migrations/001_initial.sql`
7. Run

---

### 3. Configure Cloudflare R2 (Video Storage)

1. Go to https://dash.cloudflare.com
2. R2 → Create bucket → Name: `klipio-videos`
3. Settings → CORS: Allow `https://klipio.io` and `http://localhost:3000`
4. R2 → Manage R2 API Tokens → Create Token
   - Permissions: Object Read & Write
   - Copy Access Key ID and Secret Access Key
5. Copy Account ID from the right sidebar

---

### 4. Configure Cloudways VPS (yt-dlp Worker)

1. Log into Cloudways → Your Server
2. Note the **Public IP**
3. Go to SSH/SFTP → Generate SSH key pair
4. Download private key
5. SSH into server:
```bash
ssh -i ~/.ssh/your_key USER@SERVER_IP
```
6. Install yt-dlp & FFmpeg:
```bash
# yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# FFmpeg
sudo apt update && sudo apt install ffmpeg -y

# Verify
yt-dlp --version
ffmpeg -version
```

---

### 5. Fill in .env.local

```env
# --- AI APIs ---
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
DEEPGRAM_API_KEY=YOUR_DEEPGRAM_KEY_HERE

# --- Scraping (existing) ---
APIFY_API_KEY=apify_api_l22Cu86oAdwrqsIiaessvDFZzcd7Go1fVDXV
REPLICATE_API_TOKEN=your_replicate_token_here

# --- Proxies ---
PROXY_PRIMARY_URL=http://user:pass@gate.decodo.com:10000

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# --- Cloudflare R2 ---
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=klipio-videos
R2_PUBLIC_URL=https://cdn.klipio.io

# --- Cloudways VPS ---
VPS_HOST=your_server_ip
VPS_USER=your_ssh_user
VPS_PRIVATE_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
YOUR_KEY_CONTENT_HERE
-----END OPENSSH PRIVATE KEY-----

# --- Stripe ---
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# --- App ---
NEXT_PUBLIC_APP_URL=https://klipio.io

# --- Feature Flags ---
ENABLE_ANALYSIS=true
```

---

### 6. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables on Vercel
vercel env add OPENROUTER_API_KEY
vercel env add DEEPGRAM_API_KEY
# ... add all other env vars
```

Or use Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Import GitHub repo
3. Framework: Next.js
4. Add all environment variables
5. Deploy

---

### 7. Configure Domain on Vercel

1. Vercel Dashboard → Your Project → Settings → Domains
2. Add `klipio.io`
3. Add `www.klipio.io`
4. Vercel will show DNS records
5. Go to Dynadot → klipio.io → DNS → Add Vercel's records
6. Wait 5-60 minutes for propagation

---

### 8. Configure Domain Redirects

In Cloudflare DNS:
```
klipio.app    → CNAME → klipio.io (with page rule redirect)
klipio.tech   → CNAME → klipio.io (with page rule redirect)
```

Or in Vercel:
1. Add `klipio.app` and `klipio.tech` as domains
2. Set redirect rules to `klipio.io`

---

## Project Structure

```
klipio/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── page.tsx            # Homepage (hero + URL input)
│   │   ├── layout.tsx          # Root layout (fonts, metadata)
│   │   ├── download/page.tsx   # Download result page
│   │   ├── analyze/page.tsx    # AI analysis result page
│   │   ├── history/page.tsx    # User download history
│   │   ├── pricing/page.tsx    # Pricing page
│   │   └── api/                # API routes
│   │       ├── download/       # Download endpoints
│   │       ├── analyze/        # AI analysis endpoints
│   │       ├── extract/        # Metadata extraction
│   │       ├── health/         # Health check
│   │       ├── worker/process/ # Queue worker
│   │       └── cron/           # Scheduled cleanup
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── UrlInput.tsx        # Star component
│   │   └── VideoCard.tsx
│   ├── lib/                    # Core libraries
│   │   ├── config.ts           # Central config (Zod validated)
│   │   ├── supabase.ts         # Supabase clients
│   │   ├── r2.ts               # R2 storage client
│   │   ├── ytdlp.ts            # yt-dlp SSH wrapper
│   │   ├── ffmpeg.ts           # Video processing
│   │   ├── openrouter.ts       # AI model client
│   │   ├── deepgram.ts         # Transcription client
│   │   ├── analyzer.ts         # AI pipeline orchestrator
│   │   ├── queue.ts            # Job queue
│   │   ├── proxy.ts            # Proxy rotation
│   │   ├── cost-tracker.ts     # AI cost tracking
│   │   └── analyzers/          # Specialized analyzers
│   │       ├── recipe.ts
│   │       ├── travel.ts
│   │       ├── brand.ts
│   │       └── keypoints.ts
│   ├── types/
│   │   └── analysis.ts         # TypeScript types
│   └── middleware.ts           # SSR session + security
├── supabase/
│   └── migrations/001_initial.sql
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── Dockerfile
├── vercel.json
└── .env.example
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/download` | Queue a download |
| `GET` | `/api/download` | List user downloads |
| `GET` | `/api/download/:id` | Check status / get URL |
| `DELETE` | `/api/download/:id` | Cancel download |
| `POST` | `/api/extract` | Extract metadata only |
| `POST` | `/api/analyze` | Start AI analysis |
| `GET` | `/api/analyze/:id` | Check analysis progress |
| `GET` | `/api/health` | Service health |
| `POST` | `/api/worker/process` | Process queue jobs |

---

## Cost Breakdown (Monthly at Scale)

| Service | 100K req/mo | 1M req/mo | 10M req/mo |
|---------|-------------|-----------|------------|
| Vercel Pro | $20 | $20 | $20 |
| Supabase | $25 | $75 | $350 |
| Cloudways | $28 | $56 | $112 |
| Cloudflare R2 | ~$5 | ~$30 | ~$150 |
| OpenRouter AI | ~$200 | ~$2,000 | ~$8,000 |
| Deepgram | ~$50 | ~$500 | ~$2,000 |
| Proxies | $50 | $200 | $800 |
| **TOTAL** | **~$378** | **~$2,881** | **~$11,432** |

**Revenue at 10M req/mo: ~$40,000-100,000/mo (70-90% profit margin)**

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS, Framer Motion |
| Backend | Next.js API Routes, Cloudflare Workers |
| Database | Supabase PostgreSQL |
| Storage | Cloudflare R2 |
| AI | OpenRouter (Claude, Gemini, GPT-4o) + Deepgram |
| Extraction | yt-dlp on Cloudways VPS |
| Auth | Supabase Auth |
| Payments | Stripe |
| Monitoring | Sentry, PostHog |

---

## License

Private — All rights reserved.

Built with AI by kakdigital.com
