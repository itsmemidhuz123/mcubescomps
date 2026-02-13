#!/bin/bash

echo "================================================"
echo "  SpeedCube Online - Database Setup Script"
echo "================================================"
echo ""

# Check if DATABASE_URL is set
if ! grep -q "^DATABASE_URL=" /app/.env || grep -q "DATABASE_URL=\"postgresql://placeholder" /app/.env; then
    echo "⚠️  ERROR: DATABASE_URL not configured!"
    echo ""
    echo "Please update your /app/.env file with a real PostgreSQL connection string."
    echo ""
    echo "Example:"
    echo "DATABASE_URL=\"postgresql://username:password@host:port/database?schema=public\""
    echo ""
    echo "Get a free PostgreSQL database from:"
    echo "  • Vercel Postgres: https://vercel.com (Recommended)"
    echo "  • Neon: https://neon.tech"
    echo "  • Supabase: https://supabase.com"
    echo "  • Railway: https://railway.app"
    echo ""
    exit 1
fi

echo "✓ DATABASE_URL found in .env"
echo ""

# Generate Prisma Client
echo "→ Generating Prisma Client..."
cd /app
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi

echo "✓ Prisma Client generated"
echo ""

# Run migrations
echo "→ Running database migrations..."
npx prisma migrate deploy

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  Migration failed. This might mean:"
    echo "  1. DATABASE_URL is incorrect"
    echo "  2. Database is not accessible"
    echo "  3. Permissions issue"
    echo ""
    echo "Try running: npx prisma migrate dev --name init"
    exit 1
fi

echo "✓ Database migrations completed"
echo ""

# Restart Next.js server
echo "→ Restarting Next.js server..."
sudo supervisorctl restart nextjs

echo "✓ Server restarted"
echo ""

echo "================================================"
echo "  ✅ Setup Complete!"
echo "================================================"
echo ""
echo "Your application is ready at:"
echo "  https://speedcube-compete.preview.emergentagent.com"
echo ""
echo "Next steps:"
echo "  1. Open the URL above"
echo "  2. Login with Google (first user becomes admin)"
echo "  3. Create your first competition"
echo ""
echo "Useful commands:"
echo "  • View database: npx prisma studio"
echo "  • Check logs: tail -f /var/log/supervisor/nextjs.out.log"
echo "  • Restart server: sudo supervisorctl restart nextjs"
echo ""
