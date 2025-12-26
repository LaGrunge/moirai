#!/bin/bash
# Dashboard startup script
# Generates config.js from environment variables and starts the server
# Type is auto-detected if not specified

# Default values
PORT=${PORT:-80}
DASHBOARD_THEME=${DASHBOARD_THEME:-dark}

# Generate config.js from environment variables
cat > config.js << EOF
// Dashboard Configuration - Auto-generated from environment variables
// Type will be auto-detected if not specified
window.DASHBOARD_CONFIG = {
    servers: [
EOF

# Add servers from environment variables
# Format: CI_SERVER_1_NAME, CI_SERVER_1_URL, CI_SERVER_1_TOKEN, CI_SERVER_1_TYPE (optional)
# Or single server: CI_SERVER_NAME, CI_SERVER_URL, CI_SERVER_TOKEN, CI_SERVER_TYPE (optional)

server_count=0

# Check for single server config
if [ -n "$CI_SERVER_URL" ] && [ -n "$CI_SERVER_TOKEN" ]; then
    if [ -n "$CI_SERVER_TYPE" ]; then
        type_str="type: \"${CI_SERVER_TYPE}\""
    else
        type_str=""  # Will be auto-detected
    fi
    cat >> config.js << EOF
        { name: "${CI_SERVER_NAME:-CI Server}", url: "${CI_SERVER_URL}", token: "${CI_SERVER_TOKEN}"${type_str:+, $type_str} },
EOF
    server_count=$((server_count + 1))
fi

# Check for numbered servers (CI_SERVER_1_*, CI_SERVER_2_*, etc.)
for i in $(seq 1 10); do
    url_var="CI_SERVER_${i}_URL"
    token_var="CI_SERVER_${i}_TOKEN"
    name_var="CI_SERVER_${i}_NAME"
    type_var="CI_SERVER_${i}_TYPE"

    url="${!url_var}"
    token="${!token_var}"
    name="${!name_var:-CI Server $i}"
    type="${!type_var}"

    if [ -n "$url" ] && [ -n "$token" ]; then
        if [ -n "$type" ]; then
            type_str="type: \"${type}\""
        else
            type_str=""  # Will be auto-detected
        fi
        cat >> config.js << EOF
        { name: "${name}", url: "${url}", token: "${token}"${type_str:+, $type_str} },
EOF
        server_count=$((server_count + 1))
    fi
done

cat >> config.js << EOF
    ],
    defaultTheme: "${DASHBOARD_THEME}",
    autoSelectServer: true,
    autoSelectRepo: true
};
EOF

echo "Generated config.js with $server_count server(s)"

# Start Python HTTP server
echo "Starting dashboard on http://localhost:${PORT}"
python3 -m http.server ${PORT}
