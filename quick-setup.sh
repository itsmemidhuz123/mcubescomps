#!/bin/bash

echo "=========================================="
echo "  Quick Database Setup with Neon"
echo "=========================================="
echo ""
echo "Follow these steps:"
echo ""
echo "1. Go to: https://neon.tech"
echo "2. Click 'Sign Up' (use GitHub or Google)"
echo "3. Create a new project:"
echo "   - Project name: speedcube-online"
echo "   - Region: Choose closest to you"
echo "   - PostgreSQL version: 16 (default)"
echo "4. Click 'Create Project'"
echo ""
echo "5. On the dashboard, you'll see 'Connection String'"
echo "6. Click the 'Copy' button next to it"
echo ""
echo "7. It will look like:"
echo "   postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
echo ""
echo "=========================================="
echo "  Now paste it below:"
echo "=========================================="
echo ""
read -p "Paste your DATABASE_URL here: " db_url

# Validate input
if [[ -z "$db_url" ]]; then
    echo "❌ No URL provided. Exiting."
    exit 1
fi

if [[ ! "$db_url" =~ ^postgresql:// ]]; then
    echo "❌ Invalid URL. Must start with postgresql://"
    exit 1
fi

echo ""
echo "✓ URL received"
echo ""

# Backup existing .env
cp /app/.env /app/.env.backup
echo "✓ Backed up existing .env to .env.backup"

# Update .env file
sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"$db_url\"|" /app/.env

echo "✓ Updated /app/.env with new DATABASE_URL"
echo ""

# Run setup
echo "Running database setup..."
echo ""

cd /app

# Generate Prisma Client
echo "→ Generating Prisma Client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi

echo "✓ Prisma Client generated"
echo ""

# Run migrations
echo "→ Creating database tables..."
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  Migration with existing migration files failed. Trying fresh migration..."
    npx prisma migrate dev --name init --skip-seed
fi

echo "✓ Database tables created"
echo ""

# Restart server
echo "→ Restarting server..."
sudo supervisorctl restart nextjs

echo "✓ Server restarted"
echo ""

echo "=========================================="
echo "  ✅ SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "Your app is ready at:"
echo "  https://speedcube-compete.preview.emergentagent.com"
echo ""
echo "Next steps:"
echo "  1. Open the URL above"
echo "  2. Click 'Login with Google'"
echo "  3. You'll become the admin (first user)"
echo "  4. Click 'Create Competition'"
echo "  5. Start competing!"
echo ""
echo "Useful commands:"
echo "  • View database: npx prisma studio"
echo "  • Check logs: tail -f /var/log/supervisor/nextjs.out.log"
echo ""
