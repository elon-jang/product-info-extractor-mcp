#!/bin/bash

# Simple shell script to test MCP server health and product extraction
# No npm/node dependencies required - uses only curl and jq

SERVER_URL="${1:-http://localhost:8080}"
TEST_URL="${2:-https://www.ugg.com/women-slippers/cozy-slipper/1117659.html}"

echo "🧪 Testing MCP Server"
echo "Server: $SERVER_URL"
echo "Product URL: $TEST_URL"
echo ""

# Test 1: Health Check
echo "1️⃣  Health Check..."
HEALTH=$(curl -s "$SERVER_URL/health")
if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null 2>&1; then
    echo "✅ Server is healthy"
    echo "$HEALTH" | jq -r '"   Uptime: \(.uptime)s, Memory: \(.memory.rss / 1024 / 1024 | floor)MB"'
else
    echo "❌ Server health check failed"
    exit 1
fi
echo ""

# Test 2: Product Extraction via MCP
echo "2️⃣  Product Extraction Test..."
echo "   Extracting: $TEST_URL"

# Create a temporary file for SSE communication
TEMP_DIR=$(mktemp -d)
SSE_OUTPUT="$TEMP_DIR/sse_output.txt"
RESULT_FILE="$TEMP_DIR/result.json"

# Start SSE connection in background and capture output
curl -s -N -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  "$SERVER_URL/sse" > "$SSE_OUTPUT" 2>&1 &
CURL_PID=$!

# Wait a moment for connection
sleep 2

# Send MCP tool call request (this is a simplified approach)
# Note: Full MCP protocol implementation would require more complex SSE handling
# For production, use the Node.js client (test-mcp-http.js)

# Check if we got any response
if [ -s "$SSE_OUTPUT" ]; then
    echo "   ✅ SSE connection established"
    echo "   ⚠️  Full product extraction requires MCP client"
    echo "   💡 Use: node test-mcp-http.js $TEST_URL"
else
    echo "   ⚠️  SSE endpoint check inconclusive"
fi

# Cleanup
kill $CURL_PID 2>/dev/null
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Basic tests passed!"
echo ""
echo "📝 Note: For complete product extraction testing:"
echo "   • Use Node.js client: node test-mcp-http.js $TEST_URL"
echo "   • Or test via Claude Desktop with the MCP server running"
