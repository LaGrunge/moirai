
## Why **Moirai**

In Greek mythology, **the Moirai** are the three Fates who govern the destiny of every being:

- **Clotho** spins the thread of life  
- **Lachesis** measures its length  
- **Atropos** cuts it when the time comes  

Nothing escapes their oversight.  
No action is forgotten.  
No outcome is accidental.

**Moirai** is named after them because a CI system is, in essence, a system of fate.

Every commit spins a new thread.  
Every pipeline step measures what will happen next.  
Every failure or success is an inevitable outcome of the code and rules you defined.

---

## CI as Fate

Modern CI is not just about running builds — it is about **making outcomes explicit**.

- A pipeline **will** run.
- A step **will** succeed or fail.
- A branch **will** converge or be rejected.

Moirai exists to **observe, track and reveal this fate**.

It does not change the outcome —  
it **makes it visible**.

---

## What Moirai Does

Moirai is a unified CI dashboard for **Woodpecker** and **Drone**, designed to:

- give a **single, clear view** of pipeline states across branches
- show how builds evolve over time
- make failures, retries and progress immediately obvious
- turn CI noise into a **coherent story**

No hidden transitions.  
No guesswork.  
Only the thread, the measure and the cut.

---

## Philosophy

> *“The Fates do not act out of malice or mercy.  
> They simply enforce the rules of the world.”*

Moirai follows the same principle.

It is:
- deterministic
- transparent
- unapologetically honest about build state

If a pipeline fails — it failed for a reason.  
Moirai shows you **where**, **when** and **why**.

---

## Name in One Sentence

**Moirai** is a CI dashboard that shows the fate of your builds —  
from the first commit to the final outcome.



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
