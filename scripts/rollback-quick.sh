#!/bin/bash

# Quick Rollback Script for Hoisting Migration
# Restores backed up configuration files and performs clean install

set -e  # Exit on any error

echo "🔄 Quick Rollback: Restoring hoisting configuration..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from project root"
    exit 1
fi

# Check for backup files
if [ ! -f ".npmrc.backup" ]; then
    echo "❌ Error: No .npmrc.backup found"
    exit 1
fi

if [ ! -f "pnpm-lock.yaml.backup" ]; then
    echo "❌ Error: No pnpm-lock.yaml.backup found"
    exit 1
fi

echo "✅ Found backup files"

# Restore configuration files
echo "📁 Restoring .npmrc..."
cp .npmrc.backup .npmrc

echo "📁 Restoring pnpm-lock.yaml..."
cp pnpm-lock.yaml.backup pnpm-lock.yaml

# Clean reinstall
echo "🧹 Removing node_modules..."
rm -rf node_modules

echo "📦 Reinstalling dependencies..."
pnpm install

echo "✅ Quick rollback completed successfully!"
echo ""
echo "Your configuration has been restored to:"
echo "$(cat .npmrc)"
echo ""
echo "If you continue to experience issues, run:"
echo "  ./scripts/rollback-full.sh"