#!/bin/bash
# Dashboard startup script
# Starts Flask server with API proxy - tokens stay server-side
#
# Environment variables:
#   PORT              - Server port (default: 8080)
#   DEBUG             - Enable debug mode (default: false)
#   
#   Single server:
#     CI_SERVER_NAME  - Display name
#     CI_SERVER_URL   - Server URL
#     CI_SERVER_TOKEN - API token
#     CI_SERVER_TYPE  - 'woodpecker' or 'drone' (auto-detected if not set)
#   
#   Multiple servers:
#     CI_SERVER_1_NAME, CI_SERVER_1_URL, CI_SERVER_1_TOKEN, CI_SERVER_1_TYPE
#     CI_SERVER_2_NAME, CI_SERVER_2_URL, CI_SERVER_2_TOKEN, CI_SERVER_2_TYPE
#     ... up to CI_SERVER_10_*

set -e

# Default values
export PORT=${PORT:-80}
export DEBUG=${DEBUG:-false}

# Check if at least one server is configured
if [ -z "$CI_SERVER_URL" ] && [ -z "$CI_SERVER_1_URL" ]; then
    echo "Error: No CI server configured!"
    echo "Set CI_SERVER_URL and CI_SERVER_TOKEN environment variables."
    echo "Or use CI_SERVER_1_URL, CI_SERVER_1_TOKEN for multiple servers."
    exit 1
fi

# Setup virtual environment and install dependencies
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate venv and install dependencies if needed
source "$VENV_DIR/bin/activate"
if ! python3 -c "import flask" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Start Flask server
echo "Starting CI Dashboard on http://localhost:${PORT}"
echo "Tokens are kept server-side and never exposed to the browser."

# Use sudo for privileged ports (< 1024), but use venv python
PYTHON_PATH="$VENV_DIR/bin/python3"
if [ "$PORT" -lt 1024 ] && [ "$(id -u)" -ne 0 ]; then
    echo "Port $PORT requires root privileges, using sudo..."
    sudo -E "$PYTHON_PATH" server.py
else
    "$PYTHON_PATH" server.py
fi
