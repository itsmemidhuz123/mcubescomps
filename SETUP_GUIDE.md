# 🎯 SpeedCube Online - Complete Setup Guide

## Current Status: ✅ Frontend & Backend Ready

Your speedcubing competition platform is **almost ready**! The application is fully built and running at:
**https://cubecomp-pro.preview.emergentagent.com**

## ⚠️ Required: Database Configuration

The app currently uses a **placeholder database URL**. To make it functional, you need to:

### Step 1: Get a PostgreSQL Database

Choose one of these free options:

#### Option A: Vercel Postgres (Recommended for Vercel deployment)
1. Go to https://vercel.com
2. Create/login to your account
3. Import your GitHub repository (or create a new project)
4. Go to: Project → Storage → Create Database → Postgres
5. Copy the `DATABASE_URL` from the **.env** tab

#### Option B: Neon (Fast & Free)
1. Go to https://neon.tech
2. Sign up/login
3. Create a new project
4. Copy the connection string

#### Option C: Supabase
1. Go to https://supabase.com
2. Create a new project
3. Go to Project Settings → Database
4. Copy the connection string (use "Connection pooling" with port 6543)

#### Option D: Railway
1. Go to https://railway.app
2. Create a new PostgreSQL database
3. Copy the DATABASE_URL

### Step 2: Update Environment Variables

Edit the file: `/app/.env`

Replace this line:
```env
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/speedcubing?schema=public"
```

With your actual connection string:
```env
DATABASE_URL="postgresql://username:password@host:port/database?schema=public"
```

### Step 3: Run Setup Script

```bash
cd /app
chmod +x setup.sh
./setup.sh
```

This will:
- ✓ Generate Prisma Client
- ✓ Run database migrations (create tables)
- ✓ Restart the Next.js server

### Step 4: Verify Setup

Visit: https://cubecomp-pro.preview.emergentagent.com

You should see the login page. Click "Login with Google" to authenticate.

---

## 🎮 How to Use After Setup

### First Login (Becomes Admin)
1. Click "Login with Google"
2. Authorize with your Google account
3. You'll be redirected back to the app
4. **You are now the admin** (first user automatically gets admin privileges)

### Create Your First Competition
1. Click "Create Competition" button
2. Fill in the form:
   - **Competition Name**: e.g., "Weekly 3x3 Speed Competition"
   - **URL Slug**: Auto-generated, or customize (e.g., "weekly-3x3-jan-2025")
   - **Start Date**: When the competition opens
   - **End Date**: When the competition closes
   - **5 Scrambles**: Paste official WCA-style scrambles

Example scrambles:
```
U2 F2 D' R2 D' L2 U' R2 U2 F2 D' B L' D F U2 L' U' R' U2
R2 D2 F2 R2 D' L2 D' B2 D F2 U2 B' R' U' B2 D' L B' F D
F2 D B2 D2 R2 U F2 L2 U' R2 U2 L D' R' U' F' L' D' U2 F2
D2 L2 D2 B2 D' B2 R2 U' L2 U2 B' D' F' L B' L D2 B F2
U2 R2 F2 D R2 B2 D B2 R2 D' U F' L' U2 B2 R' B' D L' R2 U'
```

3. Click "Create Competition"

### Users Join & Compete
1. Users login with Google
2. Browse competitions
3. Click on a competition to view details
4. Click "Start Competition" (⚠️ ONE TIME ONLY - no restarts!)
5. For each of 5 solves:
   - Click "Start Inspection" (15-second countdown)
   - Scramble is revealed
   - Click "Start Solve" to begin timing
   - Click "Stop" when done
6. After 5 solves, automatic redirect to leaderboard

### View Leaderboard
- Shows all completed results
- Calculates Average of 5 (Ao5)
- Drops best and worst times
- Medals for top 3 competitors

---

## 📊 Database Schema (Auto-created)

When you run the setup script, these tables are created:

### Users
- Stores user profiles from Google OAuth
- First user gets `isAdmin: true`

### UserSessions
- Manages authentication sessions
- 7-day expiry

### Competitions
- Competition details, dates, status
- Links to scrambles

### Scrambles
- 5 scrambles per competition
- Numbered 1-5

### Results
- One result per user per competition
- Stores all 5 solve times
- Tracks penalties (+2, DNF)
- Status: started/completed

---

## 🔧 Troubleshooting

### "Prisma Client not initialized"
```bash
cd /app
npx prisma generate
sudo supervisorctl restart nextjs
```

### "Cannot connect to database"
- Check your DATABASE_URL is correct
- Test connection: `npx prisma db pull`
- Verify database is accessible from your server

### "Migration failed"
```bash
cd /app
npx prisma migrate reset  # WARNING: Deletes all data
npx prisma migrate dev --name init
```

### Page shows "Loading..." forever
```bash
# Check logs
tail -100 /var/log/supervisor/nextjs.out.log

# Restart server
sudo supervisorctl restart nextjs
```

### Login not working
- Verify Emergent Auth is accessible
- Check browser console for errors
- Clear cookies and try again

---

## 🚀 Deployment to Production (Vercel)

### Prerequisites
1. GitHub account
2. Vercel account
3. PostgreSQL database (use Vercel Postgres)

### Steps
1. Push code to GitHub:
   ```bash
   cd /app
   git init
   git add .
   git commit -m "Initial commit - SpeedCube Online"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. Import to Vercel:
   - Go to https://vercel.com
   - Click "New Project"
   - Import your GitHub repository
   - Framework Preset: **Next.js**

3. Add Environment Variable:
   - In Vercel project settings → Environment Variables
   - Add: `DATABASE_URL` = your Vercel Postgres URL

4. Deploy:
   - Click "Deploy"
   - Wait for build to complete

5. Run Migration (one-time):
   - In Vercel project → Settings → Environment Variables
   - Click on the deployment
   - Open terminal and run:
     ```bash
     npx prisma migrate deploy
     ```

6. Done! Your app is live on Vercel.

---

## 🎯 Features Summary

✅ **Implemented:**
- OAuth authentication via Emergent Auth (Google)
- Admin competition creation
- WCA-style 15-second inspection timer
- +2 and DNF penalties
- 5 solves per competition
- Real-time browser timer
- Ao5 (Average of 5) calculation
- Global leaderboards
- One attempt per user (no restarts)
- Server-side validation & security
- Beautiful dark theme UI
- Responsive design
- PostgreSQL + Prisma ORM
- Vercel-ready deployment

🔮 **Future Enhancements:**
- Multiple event types (2x2, 4x4, Pyraminx, etc.)
- Paid competitions with Stripe integration
- Email notifications
- Practice mode
- User statistics & history
- Mobile app
- Real-time updates

---

## 📧 Need Help?

If you encounter any issues:
1. Check the troubleshooting section above
2. Review logs: `tail -f /var/log/supervisor/nextjs.out.log`
3. Verify environment variables in `/app/.env`
4. Ensure database is accessible
5. Restart server: `sudo supervisorctl restart nextjs`

---

## 📝 Quick Command Reference

```bash
# View database
npx prisma studio

# Check server status
sudo supervisorctl status

# Restart server
sudo supervisorctl restart nextjs

# View logs
tail -f /var/log/supervisor/nextjs.out.log

# Run migrations
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

---

**Ready to host your first online speedcubing competition? 🎉**

Just add your DATABASE_URL and run the setup script!
