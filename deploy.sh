#!/bin/bash
# V3 Grand Investment OS - Vercel Deploy Script
# Run this from the v3grand-slice directory

echo "🚀 Deploying V3 Grand Investment OS to Vercel..."
echo ""

# Check if vercel CLI is available
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm i -g vercel
fi

# Deploy to existing project
vercel deploy --prod --yes \
  --name v3grand-slice-ui \
  --build-env NEXT_PUBLIC_API_URL=https://v3grand-slice-api.vercel.app

echo ""
echo "✅ Deployment complete!"
