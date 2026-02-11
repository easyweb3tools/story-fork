#!/bin/bash
set -e

echo "Starting Story-Fork OpenClaw Agent..."

# Wait for the app server to be ready
until curl -sf http://app:3000/api/health > /dev/null 2>&1; do
  echo "Waiting for Story-Fork server..."
  sleep 5
done

echo "Story-Fork server is ready. Starting agent..."

exec npx tsx src/tools.ts
