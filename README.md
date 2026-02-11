# SpeedCube Online - Official Speedcubing Competition Platform

A full-stack Next.js application for hosting official-style online speedcubing competitions with WCA-inspired format.

## 🚀 Features

### Core Features
- **Official WCA-Style Competition Format**
  - 5 solves per competition
  - 15-second inspection timer
  - +2 penalty for 15-17 seconds inspection
  - DNF for over 17 seconds inspection
  - Average of 5 (Ao5) calculation (drop best and worst)

### Authentication
- OAuth via Emergent Auth (Google login)
- Secure session management with httpOnly cookies
- First user becomes admin automatically

### Competition System
- Admin can create competitions with:
  - Custom name and URL slug
  - Start and end dates
  - 5 official scrambles
- Users can browse and join competitions
- One attempt per user (no restarts)
- Real-time timer interface

### Leaderboard
- Live leaderboard with Ao5 rankings
- Shows all 5 solve times with penalties
- Displays user profiles with avatars
- Medal badges for top 3 positions

### Security
- Server-side session validation
- Prevents duplicate competition entries
- Validates attempt numbers
- Prevents manual POST manipulation
- No client-side trust for solve counts

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL
- **ORM**: Prisma 5.22.0
- **Auth**: Emergent Auth OAuth
- **UI**: Tailwind CSS, shadcn/ui components
- **Deployment**: Vercel-ready

## 📋 Prerequisites

Before you begin, you need:

1. **PostgreSQL Database**
   - Vercel Postgres (recommended for Vercel deployment)
   - Or Neon, Supabase, Railway, or any PostgreSQL provider
   - You'll need a `DATABASE_URL` connection string

2. **Node.js** 18+ and Yarn

## 🔧 Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd /app
yarn install
```

### 2. Configure Database

**Option A: Vercel Postgres (Recommended)**
1. Go to [vercel.com](https://vercel.com)
2. Navigate to your project → Storage → Create Database → Postgres
3. Copy the `DATABASE_URL` from the .env tab

**Option B: Other PostgreSQL Provider**
1. Sign up for [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app)
2. Create a new PostgreSQL database
3. Copy the connection string

### 3. Update Environment Variables

Edit `/app/.env`:

```env
# Replace with your actual PostgreSQL connection string
DATABASE_URL="postgresql://username:password@host:port/database?schema=public"

# Keep these as-is
NEXT_PUBLIC_BASE_URL=https://cubecomp-pro.preview.emergentagent.com
CORS_ORIGINS=*
```

### 4. Initialize Database

```bash
cd /app

# Generate Prisma Client
npx prisma generate

# Run migrations to create tables
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view your database
npx prisma studio
```

### 5. Start the Application

```bash
# Restart the Next.js server
sudo supervisorctl restart nextjs

# Check status
sudo supervisorctl status
```

## 📁 Project Structure

```
/app/
├── app/
│   ├── api/[[...path]]/route.js      # All API endpoints
│   ├── page.js                        # Home/Login page
│   ├── layout.js                      # Root layout
│   ├── competitions/[slug]/
│   │   ├── page.js                    # Competition detail page
│   │   └── leaderboard/page.js        # Leaderboard page
│   ├── solve/[resultId]/page.js       # Timer/solve page
│   └── admin/create/page.js           # Admin: create competition
├── components/ui/                     # shadcn UI components
├── lib/
│   ├── prisma.js                      # Prisma client singleton
│   └── utils.js                       # Utility functions
├── prisma/
│   └── schema.prisma                  # Database schema
├── .env                               # Environment variables
└── package.json                       # Dependencies
```

## 🗄️ Database Schema

### Tables

**Users**
- `id` (UUID, Primary Key)
- `email` (Unique)
- `name`, `picture`
- `isAdmin` (Boolean, default: false)
- `createdAt`

**UserSessions**
- `id` (UUID, Primary Key)
- `userId` (Foreign Key → Users)
- `sessionToken` (Unique)
- `expiresAt` (7 days)
- `createdAt`

**Competitions**
- `id` (UUID, Primary Key)
- `name`, `slug` (Unique)
- `startDate`, `endDate`
- `status` (upcoming/running/completed)
- `createdAt`

**Scrambles**
- `id` (UUID, Primary Key)
- `competitionId` (Foreign Key → Competitions)
- `scrambleNumber` (1-5)
- `scrambleText`
- Unique constraint on (competitionId, scrambleNumber)

**Results**
- `id` (UUID, Primary Key)
- `competitionId` (Foreign Key → Competitions)
- `userId` (Foreign Key → Users)
- `status` (started/completed)
- `attempt` (0-5)
- `time1`-`time5` (Float, milliseconds)
- `penalty1`-`penalty5` (none/+2/DNF)
- Unique constraint on (competitionId, userId)

## 🎮 User Workflows

### For Competitors

1. **Login**: Click "Login with Google" on homepage
2. **Browse Competitions**: View list of available competitions
3. **Join Competition**: 
   - Click on a competition
   - Read rules
   - Click "Start Competition" (⚠️ one-time only)
4. **Solve**:
   - Click "Start Inspection" to see scramble
   - 15-second countdown begins
   - Click "Start Solve" to begin timing
   - Click "Stop" when done
   - Repeat for all 5 solves
5. **View Results**: Automatic redirect to leaderboard after completion

### For Admins

1. **Login**: First registered user becomes admin automatically
2. **Create Competition**:
   - Click "Create Competition" button
   - Fill in competition details
   - Paste 5 official scrambles
   - Set start and end dates
   - Submit
3. **Monitor**: View leaderboards and participants

## 🔒 Security Features

- ✅ Server-side session validation on all protected routes
- ✅ HTTPOnly secure cookies for session tokens
- ✅ Prevents duplicate competition entries (unique constraint)
- ✅ Validates attempt numbers server-side
- ✅ Users can only access their own results
- ✅ Admin-only routes for competition creation
- ✅ Database-level constraints prevent cheating

## 🚢 Deployment on Vercel

1. **Push to GitHub**: Commit all changes to a GitHub repository

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Framework Preset: Next.js

3. **Add Environment Variables**:
   ```
   DATABASE_URL=your_vercel_postgres_url
   ```

4. **Deploy**: Click Deploy

5. **Run Migrations**: After first deployment, run:
   ```bash
   npx prisma migrate deploy
   ```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/session` - Exchange session_id for user data
- `GET /api/auth/me` - Get current user
- `GET /api/auth/logout` - Logout user

### Competitions
- `GET /api/competitions` - List all competitions
- `GET /api/competitions/:slug` - Get competition details
- `POST /api/competitions` - Create competition (admin only)
- `POST /api/competitions/:id/start` - Start competition (creates result)
- `GET /api/competitions/:slug/my-result` - Get user's result
- `GET /api/competitions/:slug/leaderboard` - Get leaderboard

### Results
- `GET /api/results/:id` - Get result by ID
- `POST /api/results/:id/submit` - Submit solve time

## 🧪 Testing

Before testing, ensure you have a valid `DATABASE_URL` in `.env` and have run migrations.

### Create Test Admin User (via Prisma Studio)

```bash
npx prisma studio
```

Navigate to `Users` table and create a user with `isAdmin: true`.

### Manual Testing Checklist

- [ ] User can login with Google
- [ ] Admin can create a competition
- [ ] User can view competitions
- [ ] User can start a competition (only once)
- [ ] 15-second inspection timer works
- [ ] +2 penalty applied correctly (15-17s)
- [ ] DNF applied correctly (>17s)
- [ ] Timer records all 5 solves
- [ ] Cannot go back to previous solves
- [ ] Leaderboard shows correct Ao5
- [ ] Top 3 get medals
- [ ] User cannot join same competition twice

## 🔄 Future Enhancements

- Support for multiple event types (2x2, 4x4, Pyraminx, etc.)
- Paid competitions with payment gateway integration
- Email notifications for competition start/end
- Practice mode with unlimited solves
- User statistics and history
- Export results to CSV
- Real-time competition updates
- Mobile app

## 🐛 Troubleshooting

### "Prisma Client not initialized"
```bash
cd /app
npx prisma generate
sudo supervisorctl restart nextjs
```

### "Connection refused" or database errors
- Verify `DATABASE_URL` in `.env` is correct
- Ensure database is accessible
- Run `npx prisma migrate dev` to apply schema

### "User not found" after login
- Check that Emergent Auth callback is working
- Verify session is being created in database
- Check browser cookies for `session_token`

### Page not loading
```bash
# Check logs
tail -100 /var/log/supervisor/nextjs.out.log

# Restart server
sudo supervisorctl restart nextjs
```

## 📄 License

MIT License - feel free to use this for your own competitions!

## 🤝 Contributing

This is an MVP built for speed. Contributions welcome for:
- Additional event types
- UI/UX improvements
- Mobile responsiveness
- Performance optimizations
- Security audits

## 📧 Support

For issues or questions, please create a GitHub issue or contact the development team.

---

**Built with ❤️ for the speedcubing community**
