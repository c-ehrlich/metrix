#!/bin/bash
set -e

BINARY_NAME="metrix"
INSTALL_DIR="/usr/local/bin"
PLIST_NAME="co.metrix.agent.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Installing Metrix..."

# Check if binary exists
if [ ! -f "$PROJECT_ROOT/dist/$BINARY_NAME" ]; then
    echo "Error: Binary not found at $PROJECT_ROOT/dist/$BINARY_NAME"
    echo "Run 'bun run build' first."
    exit 1
fi

# Install binary
echo "Installing binary to $INSTALL_DIR/$BINARY_NAME..."
sudo mkdir -p "$INSTALL_DIR"
sudo cp "$PROJECT_ROOT/dist/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
sudo chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Create LaunchAgents directory if needed
mkdir -p "$LAUNCH_AGENTS_DIR"

# Install launchd plist
echo "Installing launchd service..."
cp "$PROJECT_ROOT/launchd/$PLIST_NAME" "$LAUNCH_AGENTS_DIR/$PLIST_NAME"

# Unload if already loaded (ignore errors)
launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME" 2>/dev/null || true

# Load the service
launchctl load "$LAUNCH_AGENTS_DIR/$PLIST_NAME"

echo "Metrix installed and started successfully!"
echo "Logs: ~/Library/Logs/metrix.log"
echo "To check status: launchctl list | grep metrix"
