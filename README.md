# Moirai — **M**ischievous **O**verlords **R**unning **A**ll **I**ntegrations

A unified dashboard for monitoring **Woodpecker CI** and **Drone CI** pipelines.

![Moirai Dashboard](assets/moirai.png)

## Why "Moirai"?

In Greek mythology, **the Moirai** are the three Fates who govern destiny:

- **Clotho** spins the thread of life  
- **Lachesis** measures its length  
- **Atropos** cuts it when the time comes  

A CI system is, in essence, a system of fate — every commit spins a new thread, every pipeline measures what happens next, and every outcome is inevitable based on your code and rules.

**Moirai** observes, tracks, and reveals this fate.

---

## Features

### Core
- **Multi-server support** — Monitor multiple Woodpecker/Drone servers from one dashboard
- **Branch & PR tracking** — View latest build status for each branch and pull request
- **Cron builds** — Dedicated tab for scheduled/cron builds
- **Dark/Light theme** — Toggle between themes, saved in browser
- **Demo mode** — Test the UI without connecting to real servers
- **Secure** — API tokens stored server-side, never exposed to browser

### Overview Tab
- **Build statistics** — Success rate, total builds, average duration
- **Trend charts** — Daily build activity with success/failure breakdown
- **Branch breakdown** — Top branches by build count with success rates
- **Toggle views** — Switch between "Head builds only" and "All builds"
- **Click-to-filter** — Click any branch to navigate and filter

### Branches & Cron Tabs
- **Filter & sort** — Search by name, sort by status/time/name
- **Toggle visibility** — Show/hide branches and PRs separately
- **Browser history** — Back/forward navigation support

### Contributors Tab
- **Leaderboard** — Top contributors by builds, success rate, streaks
- **Podium view** — Top 3 contributors highlighted
- **Activity charts** — Build distribution and success rates
- **Profile links** — Click to open contributor profiles on GitHub/GitLab/Gitea

### Infrastructure Tab
- **Resource usage** — CPU time and estimated cost for builds
- **Cost breakdown** — Most expensive branches and individual builds
- **Queue status** — Running and pending builds
- **Duration stats** — P50, P90, P99 percentiles
- **Problem detection** — Branches with high failure rates
- **Hourly distribution** — Build activity by hour of day
- **AWS integration** — Real EC2 instance data and costs (optional)

### Settings
- **Saved repositories** — Quick access to favorite repos
- **Configurable limits** — Builds to fetch (50-1000)
- **Statistics period** — Default time range (7-90 days)
- **Cost estimation** — Custom CPU cost per hour

---

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

---

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

### AWS Integration (Optional)

For real EC2 cost data in the Infrastructure tab:

```bash
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_REGION="us-east-1"  # optional, defaults to us-east-1
```

Required IAM permissions:
- `ec2:DescribeInstances` — for instance list
- `ce:GetCostAndUsage` — for Cost Explorer data (optional)

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│ Flask Proxy │────▶│  CI Server  │
│             │     │ (server.py) │     │ (Woodpecker │
└─────────────┘     └─────────────┘     │  or Drone)  │
                          │             └─────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │  AWS APIs   │ (optional)
                    │ EC2 / Cost  │
                    └─────────────┘
```

---

## Project Structure

```
moirai/
├── index.html          # Main HTML page
├── server.py           # Flask proxy server
├── start.sh            # Startup script
├── requirements.txt    # Python dependencies (flask, requests, boto3)
├── favicon.svg         # App icon
│
├── css/
│   ├── main.css        # CSS imports
│   ├── base.css        # Base styles, variables, themes
│   ├── cards.css       # Build cards
│   ├── controls.css    # Buttons, inputs, toggles
│   ├── dropdown.css    # Config dropdown
│   ├── overview.css    # Overview tab
│   ├── contributors.css # Contributors tab
│   ├── infrastructure.css # Infrastructure tab
│   ├── settings.css    # Settings tab
│   └── stats.css       # Statistics panels
│
├── js/
│   ├── main.js         # Application entry point
│   ├── api.js          # API requests with pagination
│   ├── state.js        # Application state management
│   ├── builds.js       # Build data processing
│   ├── constants.js    # Configuration constants
│   ├── storage.js      # LocalStorage wrapper
│   ├── stats.js        # Statistics calculations
│   ├── utils.js        # Utility functions
│   ├── errors.js       # Error handling & toasts
│   ├── demo.js         # Demo mode with fake data
│   │
│   └── ui/
│       ├── cards.js        # Build cards rendering
│       ├── common.js       # Loading/error states
│       ├── dropdown.js     # Config dropdown
│       ├── tabs.js         # Tab navigation with history
│       ├── theme.js        # Dark/light theme toggle
│       ├── settings.js     # Settings tab
│       ├── overview.js     # Overview tab with charts
│       ├── contributors.js # Contributors leaderboard
│       ├── infrastructure.js # Infrastructure & costs
│       ├── globalStatus.js # Global status indicator
│       ├── periodHandler.js # Period selector handler
│       └── keyboard.js     # Keyboard shortcuts
│
└── assets/
    └── moirai.png      # Screenshot for README
```

---

## Development

### Prerequisites

- Python 3.8+
- pip packages: `flask`, `requests`, `boto3` (optional, for AWS)

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

Port 80 requires root privileges. The `start.sh` script handles this:

```bash
./start.sh  # Will prompt for sudo if needed
```

---

## Security

- **Tokens never sent to browser** — All API requests go through Flask proxy
- **XSS protection** — User input escaped before rendering
- **Sensitive files blocked** — `server.py`, `.env` not served as static files
- **AWS credentials server-side** — Never exposed to frontend

---

## License

MIT
