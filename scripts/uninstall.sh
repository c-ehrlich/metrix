#!/bin/bash
set -e

BINARY_NAME="metrix"
INSTALL_DIR="/usr/local/bin"
PLIST_NAME="co.metrix.agent.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

echo "Uninstalling Metrix..."

# Unload the service (ignore errors if not loaded)
if [ -f "$LAUNCH_AGENTS_DIR/$PLIST_NAME" ]; then
    echo "Stopping and removing launchd service..."
    launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME" 2>/dev/null || true
    rm -f "$LAUNCH_AGENTS_DIR/$PLIST_NAME"
fi

# Remove binary
if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
    echo "Removing binary..."
    sudo rm -f "$INSTALL_DIR/$BINARY_NAME"
fi

echo "Metrix uninstalled successfully!"
