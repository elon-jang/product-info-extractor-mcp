# Product Info Extractor MCP Server

> 🇰🇷 **[한국어](README.md)** | 🇺🇸 English

MCP server for automatically extracting product information (price, stock, images, color-specific sizes, etc.) from e-commerce websites.

> **⚠️ Important:** Advanced bot protection systems like DataDome may block automated access. Success rates vary by target site and network environment.

## 🚀 Quick Start (30 seconds)

### Run with Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/elon-jang/product-info-extractor-mcp.git
cd product-info-extractor-mcp

# Start server
docker compose up -d

# Test
npm install
node test-mcp-http.js "https://www.ugg.com/women-slippers/cozy-slipper/1117659.html"
```

### Local Development Mode

```bash
npm install
npx playwright install chromium
npm run start:http
```

---

## 📋 Key Features

- **🚀 High Performance:** 5-10x faster subsequent requests through browser instance reuse
- **🥷 Stealth Mode:** Bypass basic bot detection with `playwright-extra` + `puppeteer-extra-plugin-stealth`
- **🔌 MCP Protocol:** Direct integration with Claude Desktop
- **📦 Multi-Platform:** AMD64 + ARM64 (Apple Silicon & Cloud VMs) support

---

## 🐳 Docker Deployment Guide

### 1. Install Docker

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

# RHEL/CentOS/Rocky Linux
sudo dnf install -y yum-utils
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker && sudo systemctl enable docker
```

### 2. Run Server

```bash
# Run with Docker Compose (recommended)
docker compose up -d

# Or run with docker run
docker run -d -p 8080:3000 \
  -e PORT=3000 -e HOST=0.0.0.0 \
  --name product-info-extractor \
  joomanba/product-info-extractor-mcp:latest
```

### 3. Check Status

```bash
# Check container logs
docker logs -f product-info-extractor

# Health check
curl http://localhost:8080/health
```

---

## 🧪 Testing

### Node.js Test Client

```bash
npm install
node test-mcp-http.js "https://www.ugg.com/women-slippers/cozy-slipper/1117659.html"
```

### Shell Script (Simple Connection Test)

```bash
./test-server.sh http://localhost:8080
```

---

## 🔧 Claude Desktop Integration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "product-info-extractor": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:8080/sse"]
    }
  }
}
```

---

## ⚠️ Limitations

### Bot Protection Systems

The following systems may block automated access:

- **DataDome** (used by UGG.com): Success rate varies by environment
- **Cloudflare Advanced**: Additional bypass techniques required
- **PerimeterX**: Very difficult to bypass

### Recommendations

✅ Thorough testing before production use
✅ Use official APIs when available
✅ Implement retry logic and error handling
✅ Monitor success rates

---

## 📚 Advanced Guides

### Podman Environment (RHEL/CentOS)

```bash
# Install Podman
sudo dnf install -y podman

# Run
podman run -d -p 8080:3000 \
  -e PORT=3000 -e HOST=0.0.0.0 \
  --name product-info-extractor \
  docker.io/joomanba/product-info-extractor-mcp:latest
```

### Manual Installation (Without Docker)

```bash
# Install Node.js v18+
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Install Playwright dependencies
sudo npx playwright install-deps

# Setup project
npm install
npx playwright install chromium

# Start server
npm run start:http
```

### Build Image (For Developers)

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t joomanba/product-info-extractor-mcp:latest --push .
```

---

## 📄 License

MIT License
