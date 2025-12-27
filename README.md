# Product Info Extractor MCP Server

An advanced MCP server for extracting comprehensive product information from e-commerce websites (UGG, Chanel, Weverse, etc.).

## ⚡ Key Features

- **🚀 High Performance:** Keeps browser instances alive for 5-10x faster subsequent requests.
- **🥷 Stealth Mode:** Uses `playwright-extra` and `puppeteer-extra-plugin-stealth` to bypass Cloudflare and bot detection (e.g., UGG.com).
- **🔌 MCP Protocol:** Fully supports Model Context Protocol for seamless LLM integration.
- **📦 Docker Ready:** Easy deployment with Docker and Docker Compose.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally (MCP stdio)
Add to your Claude Code or MCP client configuration:

```json
{
  "mcpServers": {
    "product-info-extractor": {
      "command": "node",
      "args": ["/path/to/product-info-extractor-mcp/src/index.js"]
    }
  }
}
```

### 3. Usage (Docker - Recommended)
The easiest way to run the latest version (with Stealth Mode included):

```bash
# Pull and run directly from Docker Hub
docker run -d -p 8080:3000 \
  -e PORT=3000 \
  --name product-info-extractor \
  joomanba/product-info-extractor-mcp:latest
```

### 4. Usage (Local Dev)
Simply ask Claude:
> "Get product info for https://www.ugg.com/women-slippers/cozy-slipper/1117659.html"

## ☁️ Deployment Guide (VM/Cloud)

### 1. Provision a VM
Get a fresh Rocky Linux/RHEL VM (e.g., AWS EC2, GCP Compute Engine, Tencent Cloud).

### 2. Install Docker
```bash
# Update and install Docker (Rocky Linux/RHEL)
sudo dnf update -y
sudo dnf install -y docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Run the Extractor
```bash
docker run -d \
  --restart always \
  -p 8080:3000 \
  -e PORT=3000 \
  --name product-info-extractor \
  joomanba/product-info-extractor-mcp:latest
```

**Alternative: Docker Compose (Recommended for Production)**

For easier management and configuration:

```bash
# 1. Download docker-compose.yml or use the one in this repo
# 2. Start the service
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

**Example `docker-compose.yml`:**

```yaml
version: '3.8'

services:
  product-info-extractor:
    image: joomanba/product-info-extractor-mcp:latest
    container_name: product-info-extractor
    ports:
      - "8080:3000"
    environment:
      - PORT=3000
      - HOST=0.0.0.0
      - NODE_ENV=production
      - CACHE_TTL_MINUTES=30
    restart: always
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Alternative: Manual Installation (npm)**

If you prefer not to use Docker:

1. **Install Node.js & Playwright Dependencies:**
```bash
# Rocky Linux/RHEL
sudo dnf install -y nodejs npm
# Install system dependencies for Playwright
sudo npx playwright install-deps
```

2. **Install & Start:**
```bash
# Install project dependencies
npm install

# Install Chromium
npx playwright install chromium

# Start the server (HTTP/SSE mode)
npm run start:http
```


### 4. Connect to Claude
To use this server with Claude Desktop, use `npx -y mcp-remote` to bridge the connection. Add this to your configuration file (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "product-info-extractor": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://<YOUR_VM_IP, e.g., 127.0.0.1>:3000/sse"
      ]
    }
  }
}
```

Once configured, simply restart Claude and ask:
> "Get product info for https://www.ugg.com/..."

## 🧪 Testing

### Test via HTTP/SSE (Method 1)
If you want to test the MCP server directly without Claude:

```bash
# Terminal 1: Start the HTTP server
npm run start:http

# Terminal 2: Run the test client
node test-mcp-http.js https://www.ugg.com/women-slippers/cozy-slipper/1117659.html
```

**Expected Output:**
```
✅ Connected!
📋 Found 1 tool(s): extract_product_info
🚀 Calling extract_product_info...
=== EXTRACTION RESULT ===
{
  "product": {
    "name": "Cozy Slipper",
    "price": "$125",
    ...
  }
}
✅ Test completed successfully!
```

### Test via Shell Script (Method 2)
For testing without npm/node (uses only `curl` and `jq`):

**Prerequisites:**
```bash
# Rocky Linux/RHEL
sudo dnf install -y curl jq

# Ubuntu/Debian
sudo apt-get install -y curl jq

# macOS
brew install curl jq
```

**Run Test:**
```bash
# Start the server first (Docker or npm)
docker-compose up -d
# OR: npm run start:http

# Run the shell test
./test-server.sh http://localhost:8080
```

**Expected Output:**
```
✅ Server is healthy
   Uptime: 42s, Memory: 140MB
✅ SSE endpoint responding
✅ Basic tests passed!
```

### Test via Node.js Client (Method 3 - Full Product Extraction)
For complete product extraction testing on VM:

**Prerequisites:**
```bash
# Rocky Linux/RHEL
sudo dnf install -y nodejs npm

# Ubuntu/Debian
sudo apt-get install -y nodejs npm

# Verify installation
node --version  # Should be v18+
npm --version
```

**Install Dependencies & Run Test:**
```bash
# Clone or copy the project to VM
cd /path/to/product-info-extractor-mcp

# Install dependencies
npm install

# Start server in background
docker-compose up -d
# OR: npm run start:http &

# Run full extraction test
node test-mcp-http.js https://www.ugg.com/women-slippers/cozy-slipper/1117659.html
```

**Expected Output:**
```
🧪 Testing MCP Server at: http://127.0.0.1:8080/sse
📦 Product URL: https://www.ugg.com/women-slippers/cozy-slipper/1117659.html

🔌 Connecting to MCP server...
✅ Connected!

📋 Listing available tools...
Found 1 tool(s):
  - extract_product_info: Extract comprehensive product information...

🚀 Calling extract_product_info...

=== EXTRACTION RESULT ===
{
  "product": {
    "name": "Cozy Slipper",
    "price": "$125",
    "in_stock": true,
    "variants": [...]
  }
}
✅ Test completed successfully!
```

### Test via Claude Desktop (Method 4)
Simply restart Claude Desktop and ask:
> "Get product info for https://www.ugg.com/..."

## 🛠️ Configuration

### Docker Deployment (Remote MCP)
For team or server deployments:

1. **Start Server:**
   ```bash
   docker-compose up -d
   ```
2. **Configure Client:**
   Connect to SSE endpoint: `http://localhost:3000/sse`

### Environment Variables
- `CACHE_TTL_MINUTES`: Cache duration (default: 30)
- `LOG_LEVEL`: Logging verbosity

## 🏗️ Architecture

```text
product-info-extractor-mcp/
├── src/
│   ├── index.js              # Local MCP (stdio) server
│   ├── server-http.js        # Remote MCP (HTTP/SSE) server
│   └── extractor.js          # Core engine (Playwright + Stealth)
├── sites/                    # Site-specific adapters
├── test-extraction.js        # Verification script
└── Dockerfile                # Deployment config
```

## 🔍 Troubleshooting

### Blocking / 403 / 406 Errors
If you encounter "Block response" or 406 errors:
- This project uses **Stealth Plugin** to mimic human behavior.
- Use `node debug-ugg-stealth.js` to verify if the bypass is working.
- Ensure your IP is not blacklisted (try a residential proxy if needed).

## 📜 Version History

### v1.1.0 (2025-12-27)
- **Stealth Mode Information:** Integrated `playwright-extra` & `plugin-stealth` to fix UGG.com blocking.
- **Cleanup:** Removed 30+ temporary scripts and outdated documentation files.
- **Optimization:** Improved resource cleanup on exit.

### v1.0.0 (2025-12-18)
- Initial Release with MCP support and Docker integration.
