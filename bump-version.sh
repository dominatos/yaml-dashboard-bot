#!/usr/bin/env bash
# bump-version.sh — Automated script for incrementing and syncing version across files
# Usage: ./bump-version.sh [patch|minor|major]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$ROOT_DIR/version.txt"

if [[ ! -f "$VERSION_FILE" ]]; then
    echo "Error: version.txt not found at $VERSION_FILE"
    exit 1
fi

CURRENT_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')
IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"

BUMP_TYPE=${1:-patch}

case "$BUMP_TYPE" in
    patch)
        patch=$((patch + 1))
        ;;
    minor)
        minor=$((minor + 1))
        patch=0
        ;;
    major)
        major=$((major + 1))
        minor=0
        patch=0
        ;;
    *)
        echo "Usage: $0 [patch|minor|major]"
        exit 1
        ;;
esac

NEW_VERSION="${major}.${minor}.${patch}"

echo "Bumping version: $CURRENT_VERSION -> $NEW_VERSION"

# 1. Update version.txt
echo "$NEW_VERSION" > "$VERSION_FILE"

# 2. Update tg-admin-bot/package.json
if [[ -f "$ROOT_DIR/tg-admin-bot/package.json" ]]; then
    echo "Updating tg-admin-bot/package.json"
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$ROOT_DIR/tg-admin-bot/package.json"
fi

# 3. Update index.php
if [[ -f "$ROOT_DIR/index.php" ]]; then
    echo "Updating index.php"
    sed -i "s/define('APP_VERSION', '.*');/define('APP_VERSION', '$NEW_VERSION');/" "$ROOT_DIR/index.php"
fi

# 4. Update README.md
if [[ -f "$ROOT_DIR/README.md" ]]; then
    echo "Updating README.md"
    sed -i "s/version-.*-blue/version-$NEW_VERSION-blue/" "$ROOT_DIR/README.md"
fi


echo "Successfully bumped version to $NEW_VERSION"
echo "Files updated. Please run git commands manually to commit and tag."
