# Recall — Minimal DSA Revision Queue

Recall is a minimal, focused scheduling layer on top of your DSA notes. When you solve a problem on LeetCode, write your key insight note directly in Recall. The app will schedule when you should review that problem next, presenting your note as a self-test card before you check the actual code on LeetCode.

---

## 🚀 Local Quickstart (E Drive Virtual Environment)

To respect system boundaries, Recall is configured to run inside a virtual environment on the **E: drive** with a portable Node.js runtime.

### 1. Enable Runtimes in Your PowerShell Session
Every time you open a terminal to work on this project, prepend the portable Node.js path to your session environment:
```powershell
$env:PATH = "e:\Recall\node-bin\node-v22.12.0-win-x64;" + $env:PATH
```
Verify the active runtimes:
```powershell
node -v  # Should return v22.12.0
npm -v   # Should return 10.9.0
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Fill in the database connection strings and your authentication secret. For local development, any default/temporary database works.

*Note: In Prisma v7, connection parameters (`DATABASE_URL`, `DIRECT_URL`) are configured in `prisma.config.ts`, not `schema.prisma`.*

### 3. Generate Database Client & Apply Migrations
If you have a database set up, run:
```powershell
npx prisma migrate dev --name init
```
Or simply generate the local client types:
```powershell
npx prisma generate
```

### 4. Start Development Server
Run the local Next.js development server:
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Authentication & Local Testing
Recall implements **Passwordless Email OTP**.
1. Enter your email on the login screen.
2. In development mode, the 6-digit OTP code is **printed directly to your terminal console**. Look for:
   `[AUTH SYSTEM] OTP code for you@example.com is: XXXXXX`
3. Enter the code to authenticate immediately.

---

## ⚡ Spaced Repetition Logic (State Machine)
Each daily card is rated as one of three options:
- **`Blank`**: Reset interval to `1` day, decrement confidence score by `1` (min: `1`).
- **`Shaky`**: Increment interval by `1.5x` (min: `2` days), confidence unchanged.
- **`Got It`**: Increment interval by `2.5x` (min: `4` days), increment confidence by `1` (max: `5`).

---

## ☁️ Deployment (Vercel + Supabase)

Recall is built to deploy on Vercel with zero custom server configuration.

### 1. Database Setup
Create a free project on **Supabase** (or Neon).
1. Go to **Settings > Database** in your Supabase project dashboard.
2. Copy the **Transaction pooler** string (usually port `6543`) and set it as `DATABASE_URL`. Make sure to append `&pgbouncer=true&connection_limit=1`.
3. Copy the **Direct connection** string (usually port `5432`) and set it as `DIRECT_URL`.

### 2. Vercel Deployment
1. Push your repository to GitHub.
2. Import the project on [Vercel](https://vercel.com).
3. Under **Project Settings > Environment Variables**, add:
   - `DATABASE_URL` (Supabase Transaction Pooler URL)
   - `DIRECT_URL` (Supabase Direct URL)
   - `AUTH_SECRET` (A secure random string, e.g., generated with `openssl rand -base64 32`)
4. Click **Deploy**. Vercel will automatically configure the serverless functions and build the application.
