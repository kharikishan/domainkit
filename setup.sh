#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "  DomainKit Setup"
echo "  ==============="
echo ""

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin*) PLATFORM="macOS" ;;
  Linux*)  PLATFORM="Linux" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="Windows (Git Bash)";;
  *) PLATFORM="Unknown ($OS)" ;;
esac
echo "  Platform: $PLATFORM"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo ""
  echo "  Error: Node.js is required (>= 18)."
  echo "  Install from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "  Error: Node.js >= 18 required. You have $(node -v)"
  exit 1
fi
echo "  Node.js $(node -v) ... OK"

# Check for pnpm, install if missing
if ! command -v pnpm &> /dev/null; then
  echo "  pnpm not found. Installing..."
  npm install -g pnpm
fi
echo "  pnpm $(pnpm -v) ... OK"

# Ensure pnpm global bin directory is configured
# Set PNPM_HOME for this session based on platform
case "$PLATFORM" in
  macOS)
    export PNPM_HOME="${PNPM_HOME:-$HOME/Library/pnpm}"
    ;;
  Linux)
    export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
    ;;
  "Windows (Git Bash)")
    export PNPM_HOME="${PNPM_HOME:-$LOCALAPPDATA/pnpm}"
    ;;
esac
export PATH="$PNPM_HOME:$PATH"

if ! pnpm link --global --dry-run &> /dev/null; then
  echo "  Configuring pnpm global bin directory..."
  pnpm setup --force 2>/dev/null || true
fi

# Install dependencies
echo ""
echo "  Installing dependencies..."
pnpm install

# Build the project
echo "  Building..."
pnpm run build

# Link globally so 'dk' and 'domainkit' commands are available everywhere
# If already linked, unlink first to ensure a clean update
echo "  Linking globally..."
pnpm unlink --global domainkit 2>/dev/null || true
pnpm link --global

# Shell config hint
SHELL_CONFIG=""
case "$PLATFORM" in
  macOS)
    if [ -f "$HOME/.zshrc" ]; then
      SHELL_CONFIG="source ~/.zshrc"
    else
      SHELL_CONFIG="source ~/.bash_profile"
    fi
    ;;
  Linux)
    SHELL_CONFIG="source ~/.bashrc"
    ;;
  "Windows (Git Bash)")
    SHELL_CONFIG="Close and re-open Git Bash"
    ;;
esac

echo ""
echo "  ================================"
echo "  DomainKit installed successfully!"
echo "  ================================"
echo ""
echo "  IMPORTANT: If this is your first time, restart your terminal or run:"
echo "    $SHELL_CONFIG"
echo ""
echo "  Then try:"
echo "    dk --help"
echo "    dk --version"
echo ""
echo "  To use in any project:"
echo "    cd /path/to/your/project"
echo "    dk init"
echo ""
echo "  To update later:"
echo "    cd $(pwd)"
echo "    git pull && pnpm run build"
echo ""
echo "  To uninstall:"
echo "    pnpm unlink --global domainkit"
echo ""
