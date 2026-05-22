#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define potential paths to the .env file
PROJECT_ENV="$(dirname "$0")/../.env"
HOME_ENV="$HOME/.env"

# Check if .env files exist and source the first one found
if [ -f "$PROJECT_ENV" ]; then
  echo "Sourcing environment variables from $PROJECT_ENV"
  set -a; source "$PROJECT_ENV"; set +a
elif [ -f "$HOME_ENV" ]; then
  echo "Sourcing environment variables from $HOME_ENV"
  set -a; source "$HOME_ENV"; set +a
else
  echo "Info: .env file not found. Proceeding with existing environment variables."
fi

MANIFEST_PATH="dist/butler/manifest.json"
MANIFEST_KEY="$EXTENSION_MANIFEST_JSON_KEY"

# Check if EXTENSION_MANIFEST_JSON_KEY is set
if [ -z "$MANIFEST_KEY" ]; then
  echo "Error: EXTENSION_MANIFEST_JSON_KEY environment variable is not set." >&2
  echo "Please define it in your environment or in the .env file at the project root." >&2
  exit 1
fi

# Check if manifest.json exists
if [ ! -f "$MANIFEST_PATH" ]; then
  echo "Error: Manifest file not found at $MANIFEST_PATH." >&2
  echo "Make sure 'yarn build' has been run successfully and produced the manifest.json file in the dist/butler directory." >&2
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq to update the manifest.json file." >&2
    echo "For example, on Debian/Ubuntu: sudo apt-get install jq" >&2
    echo "On macOS (using Homebrew): brew install jq" >&2
    exit 1
fi

# Add or update the 'key' field in manifest.json
# Create a temporary file for the updated manifest
TMP_MANIFEST=$(mktemp)

jq --arg key "$MANIFEST_KEY" '.key = $key' "$MANIFEST_PATH" > "$TMP_MANIFEST" && mv "$TMP_MANIFEST" "$MANIFEST_PATH"

if [ $? -eq 0 ]; then
  echo "Successfully updated $MANIFEST_PATH with the extension key."
else
  echo "Error: Failed to update $MANIFEST_PATH." >&2
  # Clean up temporary file if mv failed
  if [ -f "$TMP_MANIFEST" ]; then
      rm "$TMP_MANIFEST"
  fi
  exit 1
fi
