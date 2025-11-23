#!/bin/bash

echo "🔍 Verifying DevSpace Localhost Setup..."
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✅ npm installed: $NPM_VERSION"
else
    echo "❌ npm not found"
    exit 1
fi

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "✅ Dependencies installed"
else
    echo "⚠️  Dependencies not installed. Run: npm install"
fi

# Check .env file
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    
    # Check for required variables
    source .env 2>/dev/null || true
    
    MISSING_VARS=()
    
    if [ -z "$VITE_SUPABASE_URL" ]; then
        MISSING_VARS+=("VITE_SUPABASE_URL")
    fi
    
    if [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
        MISSING_VARS+=("VITE_SUPABASE_PUBLISHABLE_KEY")
    fi
    
    if [ -z "$VITE_FISHAUDIO_API_KEY" ]; then
        MISSING_VARS+=("VITE_FISHAUDIO_API_KEY")
    fi
    
    if [ -z "$VITE_OPENROUTER_API_KEY" ]; then
        MISSING_VARS+=("VITE_OPENROUTER_API_KEY")
    fi
    
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        echo "✅ All required environment variables are set"
    else
        echo "⚠️  Missing environment variables: ${MISSING_VARS[*]}"
        echo "   See SETUP.md for how to get these"
    fi
else
    echo "❌ .env file missing"
    echo "   Create .env file with required variables (see SETUP.md)"
fi

# Check port 8080 availability
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8080 is already in use"
    echo "   Stop the other process or change port in vite.config.ts"
else
    echo "✅ Port 8080 is available"
fi

echo ""
echo "📋 Quick Start:"
echo "   1. Ensure .env file has all required variables"
echo "   2. Run database migration in Supabase Dashboard"
echo "   3. Run: npm run dev"
echo "   4. Visit: http://localhost:8080"
echo ""
echo "📚 See SETUP.md for detailed instructions"

