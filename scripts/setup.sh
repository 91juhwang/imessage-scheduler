#!/bin/sh
set -e

echo "Installing root dependencies..."
pnpm -w install

echo "Installing gateway dependencies..."
pnpm -C gateway install

echo "Done."
