#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define the path to the .env file relative to the script's location
# Assuming the script is in project_root/scripts/update-manifest.sh
# and .env is in project_root/.env
ENV_FILE="$(dirname "$0")/../.env"

# Check if .env file exists and source it
if [ -f "$ENV_FILE" ]; then
  echo "Sourcing environment variables from $ENV_FILE"
  # Use 'set -a' to export all variables defined in the .env file
  # and 'set +a' to revert this behavior.
  # Use a subshell to avoid polluting the current shell's environment
  # if the script is sourced.
  (set -a; source "$ENV_FILE"; set +a)
else
  echo "Info: .env file not found at $ENV_FILE. Proceeding with existing environment variables."
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
