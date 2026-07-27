@echo off
onchainos agent update --agent-id 6077 --service "[{\"operation\":\"update\",\"id\":\"37339\",\"serviceName\":\"TACIT Watch\",\"serviceDescription\":\"Monitors any URL and alerts you the instant its content, status code, schema, or latency changes.\n1. url to watch 2. checkType (content, status, schema, or latency) 3. webhookUrl for alerts (optional, default check interval is 5 minutes)\",\"serviceType\":\"A2MCP\",\"fee\":\"0.02\",\"endpoint\":\"https://tacit-agent.vercel.app/api/watch\"}]"
pause
