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

if [ ! -f "${CONFIG_PATH}" ]; then
  cat > "${CONFIG_PATH}" <<JSON
{
  "models": {
    "mode": "merge",
    "providers": {
      "anyrouter": {
        "baseUrl": "${ANYROUTER_BASE_URL}",
        "apiKey": "${ANYROUTER_API_KEY}",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "${ANYROUTER_MODEL_ID}",
            "name": "${ANYROUTER_MODEL_NAME}",
            "reasoning": true,
            "input": ["text", "image"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "anyrouter/${ANYROUTER_MODEL_ID}" }
    }
  }
}
JSON
  echo "Initialized OpenClaw config with default provider: anyrouter"
else
  echo "OpenClaw config already exists, keep existing config at ${CONFIG_PATH}"
fi

# Wait for the app server to be ready
until curl -sf http://app:3000/api/health > /dev/null 2>&1; do
  echo "Waiting for Story-Fork server..."
  sleep 5
done

echo "Story-Fork server is ready. Starting agent..."

exec npx tsx src/tools.ts
