#!/bin/bash

# Script to launch VS Code with the Spock Test Runner extension loaded
# and the sample project opened
# Usage: ./run-vscode.sh [gradle|maven]

echo "🚀 Starting VS Code with Spock Test Runner extension..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAMPLE_PROJECTS_DIR="$SCRIPT_DIR/sample-projects"

# Determine which project to open (default to gradle)
PROJECT_TYPE="${1:-gradle}"

if [ "$PROJECT_TYPE" = "maven" ]; then
    SAMPLE_PROJECT_DIR="$SAMPLE_PROJECTS_DIR/maven-project"
elif [ "$PROJECT_TYPE" = "gradle" ]; then
    SAMPLE_PROJECT_DIR="$SAMPLE_PROJECTS_DIR/gradle-project"
else
    echo "❌ Invalid project type: $PROJECT_TYPE"
    echo "Usage: ./run-vscode.sh [gradle|maven]"
    exit 1
fi

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ VS Code is not installed or not in PATH"
    echo "Please install VS Code and make sure 'code' command is available"
    exit 1
fi

# Check if sample project exists
if [ ! -d "$SAMPLE_PROJECT_DIR" ]; then
    echo "❌ Sample project directory not found: $SAMPLE_PROJECT_DIR"
    exit 1
fi

# Build the extension if needed
echo "🔨 Building extension..."
cd "$SCRIPT_DIR"
npm run compile

if [ $? -ne 0 ]; then
    echo "❌ Failed to build extension"
    exit 1
fi

# Package the extension
echo "📦 Packaging extension..."
npm run package

if [ $? -ne 0 ]; then
    echo "❌ Failed to package extension"
    exit 1
fi

# Find the latest .vsix file
VSIX_FILE=$(ls -t *.vsix | head -n 1)

if [ -z "$VSIX_FILE" ]; then
    echo "❌ No .vsix file found"
    exit 1
fi

echo "📦 Found extension: $VSIX_FILE"

# Install the extension
echo "🔌 Installing extension..."
code --install-extension "$VSIX_FILE" --force

if [ $? -ne 0 ]; then
    echo "❌ Failed to install extension"
    exit 1
fi

# Launch VS Code with the sample project
echo "🎯 Opening VS Code with sample project..."
code "$SAMPLE_PROJECT_DIR"

echo "✅ VS Code launched with Spock Test Runner extension!"
echo ""
echo "📋 What you can do now:"
echo "  1. Open the Test Explorer (Ctrl+Shift+P -> 'Test: Focus on Test Explorer View')"
echo "  2. Run individual tests or test classes"
echo "  3. Debug tests by setting breakpoints"
echo "  4. Explore data-driven test iterations"
echo "  5. Test the extension with real Spock tests"
echo ""
echo "🎮 Sample project includes:"
echo "  - BowlingGame.java - Complete bowling game implementation"
echo "  - Multiple Spock test classes with all where block variations"
echo "  - Edge cases: empty files, nested classes, malformed syntax"
echo "  - Real test data and scenarios"
