#!/bin/bash

# Full Rollback Script for Hoisting Migration
# Complete restoration including cleanup of migration artifacts

set -e  # Exit on any error

echo "🔄 Full Rollback: Complete restoration of hoisting configuration..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from project root"
    exit 1
fi

# Restore configuration files
if [ -f ".npmrc.backup" ]; then
    echo "📁 Restoring .npmrc from backup..."
    cp .npmrc.backup .npmrc
else
    echo "⚠️  No .npmrc.backup found, creating fallback configuration..."
    echo "shamefully-hoist=true" > .npmrc
fi

if [ -f "pnpm-lock.yaml.backup" ]; then
    echo "📁 Restoring pnpm-lock.yaml from backup..."
    cp pnpm-lock.yaml.backup pnpm-lock.yaml
else
    echo "⚠️  No pnpm-lock.yaml.backup found"
fi

# Clean all generated files
echo "🧹 Cleaning generated files..."
rm -rf node_modules
rm -f pnpm-lock.yaml
rm -rf dist
rm -rf out

# Remove migration artifacts
echo "🗑️  Removing migration artifacts..."
rm -f hoisting-migration-report.json
rm -f .npmrc.conservative
rm -f .npmrc.moderate
rm -f .npmrc.aggressive
rm -f .npmrc.fallback

# Fresh install
echo "📦 Performing fresh install..."
pnpm install

# Rebuild native modules
echo "🔧 Rebuilding native modules..."
pnpm run rebuild

# Run basic verification
echo "🔍 Running basic verification..."
if pnpm run typecheck; then
    echo "✅ TypeScript compilation successful"
else
    echo "⚠️  TypeScript compilation failed - may require manual intervention"
fi

echo ""
echo "✅ Full rollback completed!"
echo ""
echo "Your configuration has been restored to:"
echo "$(cat .npmrc)"
echo ""
echo "Migration artifacts have been removed."
echo "If you want to attempt migration again, you'll need to:"
echo "1. Re-run the migration script"
echo "2. Or manually create configuration files"