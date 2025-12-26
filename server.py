#!/usr/bin/env python3
"""
Moirai Dashboard Server with API Proxy
Serves static files and proxies API requests to CI servers with tokens.
Tokens are stored server-side and never exposed to the browser.
Optionally supports AWS for autoscaler cost data.
"""

import os
import json
import requests
from flask import Flask, send_from_directory, request, Response, jsonify

app = Flask(__name__, static_folder='.')

# AWS configuration (optional)
AWS_ENABLED = bool(os.environ.get('AWS_ACCESS_KEY_ID') and os.environ.get('AWS_SECRET_ACCESS_KEY'))
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

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

# EC2 instance pricing (on-demand, us-east-1, approximate)
EC2_HOURLY_PRICES = {
    # T3 instances
    't3.micro': 0.0104,
    't3.small': 0.0208,
    't3.medium': 0.0416,
    't3.large': 0.0832,
    't3.xlarge': 0.1664,
    't3.2xlarge': 0.3328,
    # T2 instances
    't2.micro': 0.0116,
    't2.small': 0.023,
    't2.medium': 0.0464,
    't2.large': 0.0928,
    't2.xlarge': 0.1856,
    # M5 instances
    'm5.large': 0.096,
    'm5.xlarge': 0.192,
    'm5.2xlarge': 0.384,
    'm5.4xlarge': 0.768,
    # C5 instances
    'c5.large': 0.085,
    'c5.xlarge': 0.17,
    'c5.2xlarge': 0.34,
    'c5.4xlarge': 0.68,
    # C7g instances (Graviton)
    'c7g.medium': 0.0363,
    'c7g.large': 0.0725,
    'c7g.xlarge': 0.145,
    'c7g.2xlarge': 0.29,
    'c7g.4xlarge': 0.58,
    # R5 instances
    'r5.large': 0.126,
    'r5.xlarge': 0.252,
}

# API endpoint to check AWS status
@app.route('/api/aws/status')
def aws_status():
    return jsonify({
        'enabled': AWS_ENABLED,
        'region': AWS_REGION if AWS_ENABLED else None
    })

# API endpoint to get EC2 instances (CI agents)
@app.route('/api/aws/instances')
def aws_instances():
    if not AWS_ENABLED:
        return jsonify({'error': 'AWS not configured'}), 400
    
    try:
        import boto3
        from datetime import datetime, timezone
        
        ec2 = boto3.client('ec2', region_name=AWS_REGION)
        
        # Get all running/stopped instances (filter by tag if needed)
        # You can add filters like: Filters=[{'Name': 'tag:Role', 'Values': ['ci-agent']}]
        response = ec2.describe_instances()
        
        instances = []
        for reservation in response['Reservations']:
            for instance in reservation['Instances']:
                # Get instance name from tags
                name = None
                for tag in instance.get('Tags', []):
                    if tag['Key'] == 'Name':
                        name = tag['Value']
                        break
                
                # Calculate uptime
                launch_time = instance.get('LaunchTime')
                uptime_hours = 0
                if launch_time and instance['State']['Name'] == 'running':
                    uptime_hours = (datetime.now(timezone.utc) - launch_time).total_seconds() / 3600
                
                instance_type = instance['InstanceType']
                hourly_cost = EC2_HOURLY_PRICES.get(instance_type, 0.10)  # default $0.10/hr
                
                instances.append({
                    'id': instance['InstanceId'],
                    'name': name,
                    'type': instance_type,
                    'state': instance['State']['Name'],
                    'launch_time': launch_time.isoformat() if launch_time else None,
                    'private_ip': instance.get('PrivateIpAddress'),
                    'uptime_hours': round(uptime_hours, 2),
                    'hourly_cost': hourly_cost,
                    'estimated_cost': round(uptime_hours * hourly_cost, 2)
                })
        
        return jsonify({
            'instances': instances,
            'total_running': len([i for i in instances if i['state'] == 'running']),
            'total_hourly_cost': sum(i['hourly_cost'] for i in instances if i['state'] == 'running')
        })
    except ImportError:
        return jsonify({'error': 'boto3 not installed. Run: pip install boto3'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# API endpoint to get AWS cost data for a period
@app.route('/api/aws/costs')
def aws_costs():
    if not AWS_ENABLED:
        return jsonify({'error': 'AWS not configured', 'available': False})
    
    try:
        import boto3
        from datetime import datetime, timedelta
        
        # Get period from query params (default 30 days)
        days = int(request.args.get('days', 30))
        
        ce = boto3.client('ce', region_name='us-east-1')  # Cost Explorer is only in us-east-1
        
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        # Get cost by service
        response = ce.get_cost_and_usage(
            TimePeriod={'Start': start_date, 'End': end_date},
            Granularity='DAILY',
            Metrics=['UnblendedCost'],
            GroupBy=[{'Type': 'DIMENSION', 'Key': 'SERVICE'}]
        )
        
        # Extract EC2 costs
        daily_costs = []
        total_cost = 0
        ec2_cost = 0
        
        for result in response['ResultsByTime']:
            date = result['TimePeriod']['Start']
            day_total = 0
            day_ec2 = 0
            
            for group in result['Groups']:
                service = group['Keys'][0]
                cost = float(group['Metrics']['UnblendedCost']['Amount'])
                day_total += cost
                if 'EC2' in service:
                    day_ec2 += cost
            
            daily_costs.append({
                'date': date,
                'total': round(day_total, 2),
                'ec2': round(day_ec2, 2)
            })
            total_cost += day_total
            ec2_cost += day_ec2
        
        return jsonify({
            'available': True,
            'period_days': days,
            'total_cost': round(total_cost, 2),
            'ec2_cost': round(ec2_cost, 2),
            'daily_costs': daily_costs
        })
    except ImportError:
        return jsonify({'error': 'boto3 not installed', 'available': False})
    except Exception as e:
        # Return 200 with error info so frontend can handle gracefully
        return jsonify({'error': str(e), 'available': False})

# API endpoint to get Auto Scaling group info
@app.route('/api/aws/autoscaler')
def aws_autoscaler():
    if not AWS_ENABLED:
        return jsonify({'error': 'AWS not configured'}), 400
    
    try:
        import boto3
        
        autoscaling = boto3.client('autoscaling', region_name=AWS_REGION)
        
        groups = autoscaling.describe_auto_scaling_groups()['AutoScalingGroups']
        
        result = []
        for group in groups:
            result.append({
                'name': group['AutoScalingGroupName'],
                'desired': group['DesiredCapacity'],
                'min': group['MinSize'],
                'max': group['MaxSize'],
                'instances': len(group.get('Instances', []))
            })
        
        return jsonify(result)
    except ImportError:
        return jsonify({'error': 'boto3 not installed'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 80))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    print(f"Loaded {len(SERVERS)} server(s)")
    for s in SERVERS:
        print(f"  - {s['name']} ({s['url']})")
    
    if AWS_ENABLED:
        print(f"AWS integration enabled (region: {AWS_REGION})")
    else:
        print("AWS integration disabled (set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to enable)")
    
    print(f"\nStarting dashboard on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
