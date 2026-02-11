#!/usr/bin/env sh
set -e

echo "Starting Story-Fork OpenClaw Agent..."

STATE_DIR="${OPENCLAW_STATE_DIR:-/home/node/.openclaw}"
CONFIG_PATH="${STATE_DIR}/openclaw.json"

mkdir -p "${STATE_DIR}"

export OPENCLAW_STATE_DIR="${STATE_DIR}"
export OPENCLAW_CONFIG_PATH="${CONFIG_PATH}"
export HOME="${HOME:-/home/node}"
export XDG_STATE_HOME="${STATE_DIR}"
export XDG_DATA_HOME="${STATE_DIR}"

ANYROUTER_BASE_URL="${ANYROUTER_BASE_URL:-https://anyrouter.top}"
ANYROUTER_API_KEY="${ANYROUTER_API_KEY:-sk-free}"
ANYROUTER_MODEL_ID="${ANYROUTER_MODEL_ID:-claude-opus-4-6}"
ANYROUTER_MODEL_NAME="${ANYROUTER_MODEL_NAME:-Claude Opus 4.6}"
STORY_FORK_SERVER_URL="${STORY_FORK_SERVER_URL:-http://app:3000}"
APP_HEALTH_URL="${APP_HEALTH_URL:-${STORY_FORK_SERVER_URL%/}/api/health}"
APP_HEALTH_INTERVAL_SEC="${APP_HEALTH_INTERVAL_SEC:-5}"
APP_HEALTH_MAX_RETRIES="${APP_HEALTH_MAX_RETRIES:-60}"

if [ ! -f "${CONFIG_PATH}" ]; then
  node -e '
const fs = require("fs");
const config = {
  models: {
    mode: "merge",
    providers: {
      anyrouter: {
        baseUrl: process.env.ANYROUTER_BASE_URL,
        apiKey: process.env.ANYROUTER_API_KEY,
        api: "anthropic-messages",
        models: [
          {
            id: process.env.ANYROUTER_MODEL_ID,
            name: process.env.ANYROUTER_MODEL_NAME,
            reasoning: true,
            input: ["text", "image"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192
          }
        ]
      }
    }
  },
  agents: {
    defaults: {
      model: { primary: `anyrouter/${process.env.ANYROUTER_MODEL_ID}` }
    }
  }
};
fs.writeFileSync(process.env.OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2));
'
  echo "Initialized OpenClaw config with default provider: anyrouter"
else
  echo "OpenClaw config already exists, keep existing config at ${CONFIG_PATH}"
fi

# Wait for the app server to be ready
attempt=1
until curl -fsS --max-time 3 "${APP_HEALTH_URL}" > /dev/null 2>&1; do
  if [ "${attempt}" -ge "${APP_HEALTH_MAX_RETRIES}" ]; then
    echo "Story-Fork server health check failed after ${APP_HEALTH_MAX_RETRIES} attempts: ${APP_HEALTH_URL}" >&2
    exit 1
  fi

  echo "Waiting for Story-Fork server... (${attempt}/${APP_HEALTH_MAX_RETRIES})"
  attempt=$((attempt + 1))
  sleep "${APP_HEALTH_INTERVAL_SEC}"
done

echo "Story-Fork server is ready. Starting agent..."

exec npx tsx src/tools.ts
