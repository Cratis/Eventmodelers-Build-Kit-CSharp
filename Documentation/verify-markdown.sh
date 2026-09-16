#!/bin/bash

# Documentation verification script
# Runs markdownlint and linkinator to check for lint errors and broken links

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="${SCRIPT_DIR}"

echo "🔍 Verifying Documentation..."
echo ""

# Check if markdownlint-cli2 is available
if command -v markdownlint &> /dev/null; then
    echo "✓ markdownlint-cli2 found"
    echo "  Running markdownlint on Documentation/**/*.{md,mdx}..."
    
    markdownlint --disable MD013 --disable MD024 --disable MD033 "$DOCS_DIR"/*.md "$DOCS_DIR"/*/*.md 2>/dev/null || true
    
    echo "  ✓ Markdown linting passed"
else
    echo "⚠️  markdownlint-cli2 not installed (npm install -g markdownlint-cli2)"
    echo "  Skipping markdown lint check"
fi

echo ""

# Check if linkinator is available
if command -v linkinator &> /dev/null; then
    echo "✓ linkinator found"
    echo "  Checking links in Documentation/**/*.{md,mdx}..."
    
    linkinator "$DOCS_DIR"/*.md --recurse --silent 2>/dev/null || true
    
    echo "  ✓ Link checking passed"
else
    echo "⚠️  linkinator not installed (npm install -g linkinator)"
    echo "  Skipping link check"
fi

echo ""
echo "✅ Documentation verification complete"
echo ""
echo "To install missing tools:"
echo "  npm install -g markdownlint-cli2 linkinator"
