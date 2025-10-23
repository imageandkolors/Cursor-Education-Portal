#!/bin/bash

echo "🚀 Setting up SmartEdu360..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your database credentials and secrets"
fi

# Check if Prisma is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx is not available. Please install npm and try again."
    exit 1
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Check if database is accessible
echo "🔍 Checking database connection..."
if npx prisma db push --accept-data-loss; then
    echo "✅ Database connection successful"
    
    # Ask if user wants to seed the database
    read -p "🌱 Do you want to seed the database with demo data? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🌱 Seeding database..."
        npm run db:seed
    fi
else
    echo "❌ Database connection failed. Please check your DATABASE_URL in .env.local"
    echo "💡 You can use a free PostgreSQL database from:"
    echo "   - Vercel Postgres: https://vercel.com/storage/postgres"
    echo "   - Supabase: https://supabase.com"
    echo "   - Railway: https://railway.app"
    echo "   - Neon: https://neon.tech"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env.local with your database credentials"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "🔑 Demo accounts (if seeded):"
echo "   Admin: admin@demoschool.edu / admin123"
echo "   Teacher: teacher@demoschool.edu / teacher123"
echo "   Student: student@demoschool.edu / student123"
echo ""
echo "📱 Mobile app setup:"
echo "   Run 'npx cap add ios' and 'npx cap add android' to add mobile platforms"
echo "   Run 'npx cap sync' after making changes"
echo ""
echo "🚀 Happy coding!"