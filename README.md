# CI Dashboard

A unified dashboard for monitoring **Woodpecker CI** and **Drone CI** pipelines.

![CI Dashboard](favicon.svg)

## Features

- **Multi-server support** — Monitor multiple CI servers from one dashboard
- **Branch & PR tracking** — View latest build status for each branch and pull request
- **Cron builds** — Dedicated tab for scheduled/cron builds
- **Dark/Light theme** — Toggle between themes, saved in browser
- **Demo mode** — Test the UI without connecting to real servers
- **Secure** — API tokens are stored server-side, never exposed to browser

## Quick Start

### 1. Set environment variables

```bash
# Single server
export CI_SERVER_NAME="My CI"
export CI_SERVER_URL="https://ci.example.com"
export CI_SERVER_TOKEN="your-api-token"

# Or multiple servers
export CI_SERVER_1_NAME="Woodpecker"
export CI_SERVER_1_URL="https://woodpecker.example.com"
export CI_SERVER_1_TOKEN="token1"

export CI_SERVER_2_NAME="Drone"
export CI_SERVER_2_URL="https://drone.example.com"
export CI_SERVER_2_TOKEN="token2"
```

### 2. Start the server

```bash
./start.sh
```

The dashboard will be available at `http://localhost:80`.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `80` |
| `DEBUG` | Enable Flask debug mode | `false` |
| `CI_SERVER_NAME` | Display name for single server | `CI Server` |
| `CI_SERVER_URL` | Server URL (required) | — |
| `CI_SERVER_TOKEN` | API token (required) | — |
| `CI_SERVER_TYPE` | `woodpecker`, `drone`, or `auto` | `auto` |

For multiple servers, use numbered variables: `CI_SERVER_1_NAME`, `CI_SERVER_1_URL`, etc. (up to 10 servers).

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│ Flask Proxy │────▶│  CI Server  │
│             │     │ (server.py) │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    Tokens stored
                    server-side
```

## Project Structure

```
CIDashboard/
├── index.html          # Main HTML page
├── styles.css          # Styles (dark/light themes)
├── server.py           # Flask proxy server
├── start.sh            # Startup script
├── requirements.txt    # Python dependencies
│
└── js/
    ├── main.js         # Application entry point
    ├── api.js          # API requests via proxy
    ├── state.js        # Application state
    ├── builds.js       # Build data processing
    ├── demo.js         # Demo mode
    ├── errors.js       # Error handling
    ├── utils.js        # Utility functions
    │
    └── ui/
        ├── cards.js    # Build cards rendering
        ├── common.js   # Common UI functions
        ├── dropdown.js # Config dropdown
        ├── settings.js # Settings tab
        ├── tabs.js     # Tab navigation
        └── theme.js    # Theme toggle
```

## Development

### Prerequisites

- Python 3.8+
- Flask (`pip install flask requests`)

### Running locally

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set environment variables and run
export CI_SERVER_URL="https://your-ci-server.com"
export CI_SERVER_TOKEN="your-token"
python3 server.py
```

### Running on port 80

Port 80 requires root privileges. The `start.sh` script handles this automatically:

```bash
./start.sh  # Will prompt for sudo if needed
```

## Security

- **Tokens are never sent to the browser** — All API requests go through the Flask proxy
- **XSS protection** — User input is escaped before rendering
- **Sensitive files blocked** — `server.py`, `.env` are not served as static files

## License

MIT
