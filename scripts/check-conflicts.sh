#!/usr/bin/env bash
set -euo pipefail

if rg --line-number --no-heading "^(<<<<<<<|=======|>>>>>>>)" .; then
  echo "\nConflict markers found. Resolve files above before committing."
  exit 1
fi

echo "No merge conflict markers found."
