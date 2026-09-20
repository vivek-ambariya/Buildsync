#!/usr/bin/env bash
# Start the API and the frontend together, and stop both cleanly on Ctrl-C.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d backend/.venv ]; then
  echo "backend/.venv is missing. Run the backend setup in README.md first."
  exit 1
fi
if [ ! -d frontend/node_modules ]; then
  echo "frontend/node_modules is missing. Run 'npm install' in frontend/ first."
  exit 1
fi

if ! (backend/.venv/bin/python - <<'PY'
import socket, sys
sys.exit(0 if socket.socket().connect_ex(("127.0.0.1", 27017)) == 0 else 1)
PY
); then
  echo "MongoDB is not reachable on localhost:27017."
  echo "Start it with: brew services start mongodb-community"
  exit 1
fi

cleanup() { echo; echo "Stopping…"; kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

( cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000 ) &
( cd frontend && npm run dev ) &

echo
echo "  API       http://127.0.0.1:8000       (docs at /docs)"
echo "  Frontend  http://localhost:5173"
echo "  Sign in   vivek@buildsync.ai / buildsync"
echo
wait
