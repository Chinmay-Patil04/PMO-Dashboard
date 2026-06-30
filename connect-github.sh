#!/bin/bash
# Connect & push ISP PM Dashboard to GitHub
# Repo: https://github.com/Chinmay-Patil04/PMO-Dashboard

set -e
cd "$(dirname "$0")"

GH=""
if command -v gh >/dev/null 2>&1; then
  GH=gh
elif [ -x /tmp/gh_2.67.0_macOS_arm64/bin/gh ]; then
  GH=/tmp/gh_2.67.0_macOS_arm64/bin/gh
fi

echo "=== GitHub Connect: PMO-Dashboard ==="
echo "Profile: https://github.com/Chinmay-Patil04"
echo ""

if [ -n "$GH" ]; then
  if ! $GH auth status >/dev/null 2>&1; then
    echo "Step 1: Log in to GitHub (browser will open)..."
    $GH auth login --hostname github.com --git-protocol https --web
  else
    echo "Already logged in to GitHub."
  fi
  $GH auth setup-git
else
  echo "Install GitHub CLI: https://cli.github.com"
  echo "Or push manually after setting credentials."
fi

echo ""
echo "Step 2: Pushing to GitHub..."
git push -u origin main

echo ""
echo "Step 3: Enable GitHub Pages"
echo "  → https://github.com/Chinmay-Patil04/PMO-Dashboard/settings/pages"
echo "  → Source: GitHub Actions (workflow already included)"
echo ""
echo "Live URL (after deploy): https://chinmay-patil04.github.io/PMO-Dashboard/"
echo "Done."
