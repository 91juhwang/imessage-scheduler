#!/bin/sh
set -e

REQUIRED_NODE_MAJOR=22
CURRENT_NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$CURRENT_NODE_MAJOR" -ne "$REQUIRED_NODE_MAJOR" ]; then
  echo "Node ${REQUIRED_NODE_MAJOR}.x is required. You are running $(node -v)."
  echo "Use nvm: nvm install ${REQUIRED_NODE_MAJOR} && nvm use ${REQUIRED_NODE_MAJOR}"
  exit 1
fi

echo "Installing root dependencies..."
pnpm -w install

echo "Installing gateway dependencies..."
pnpm -C gateway install

echo "Done."
