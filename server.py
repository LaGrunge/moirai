#!/usr/bin/env python3
"""
Moirai Dashboard Server with API Proxy
Serves static files and proxies API requests to CI servers with tokens.
Tokens are stored server-side and never exposed to the browser.
"""

import os
import json
import requests
from flask import Flask, send_from_directory, request, Response, jsonify

app = Flask(__name__, static_folder='.')

# Load server configurations from environment variables
def load_servers():
    servers = []
    
    # Single server config
    if os.environ.get('CI_SERVER_URL') and os.environ.get('CI_SERVER_TOKEN'):
        servers.append({
            'id': 'server-0',
            'name': os.environ.get('CI_SERVER_NAME', 'CI Server'),
            'url': os.environ.get('CI_SERVER_URL').rstrip('/'),
            'token': os.environ.get('CI_SERVER_TOKEN'),
            'type': os.environ.get('CI_SERVER_TYPE', 'auto')
        })
    
    # Numbered servers (CI_SERVER_1_*, CI_SERVER_2_*, etc.)
    for i in range(1, 11):
        url = os.environ.get(f'CI_SERVER_{i}_URL')
        token = os.environ.get(f'CI_SERVER_{i}_TOKEN')
        if url and token:
            servers.append({
                'id': f'server-{i}',
                'name': os.environ.get(f'CI_SERVER_{i}_NAME', f'CI Server {i}'),
                'url': url.rstrip('/'),
                'token': token,
                'type': os.environ.get(f'CI_SERVER_{i}_TYPE', 'auto')
            })
    
    return servers

SERVERS = load_servers()

# Get server by ID
def get_server(server_id):
    for server in SERVERS:
        if server['id'] == server_id:
            return server
    return None

# Serve static files
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    # Don't serve server.py or other sensitive files
    if path in ['server.py', '.env', 'config.js']:
        return 'Not found', 404
    return send_from_directory('.', path)

# API endpoint to get server list (without tokens!)
@app.route('/api/servers')
def list_servers():
    # Return servers without tokens
    safe_servers = [{
        'id': s['id'],
        'name': s['name'],
        'type': s['type'],
        'url': s['url']  # URL is needed for building links
    } for s in SERVERS]
    return jsonify(safe_servers)

# Proxy API requests to CI servers
@app.route('/proxy/<server_id>/<path:endpoint>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy_request(server_id, endpoint):
    server = get_server(server_id)
    if not server:
        return jsonify({'error': 'Server not found'}), 404
    
    # Build target URL
    target_url = f"{server['url']}/api/{endpoint}"
    
    # Forward query parameters
    if request.query_string:
        target_url += f"?{request.query_string.decode()}"
    
    # Prepare headers with token
    headers = {
        'Authorization': f"Bearer {server['token']}",
        'Content-Type': 'application/json'
    }
    
    try:
        # Forward the request
        if request.method == 'GET':
            resp = requests.get(target_url, headers=headers, timeout=30)
        elif request.method == 'POST':
            resp = requests.post(target_url, headers=headers, json=request.get_json(), timeout=30)
        elif request.method == 'PUT':
            resp = requests.put(target_url, headers=headers, json=request.get_json(), timeout=30)
        elif request.method == 'DELETE':
            resp = requests.delete(target_url, headers=headers, timeout=30)
        
        # Return response
        return Response(
            resp.content,
            status=resp.status_code,
            content_type=resp.headers.get('Content-Type', 'application/json')
        )
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 502

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 80))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    print(f"Loaded {len(SERVERS)} server(s)")
    for s in SERVERS:
        print(f"  - {s['name']} ({s['url']})")
    
    print(f"\nStarting dashboard on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
