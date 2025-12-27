# Product Info Extractor MCP Server

An advanced MCP server for extracting comprehensive product information from e-commerce websites (UGG, Chanel, Weverse, etc.) with built-in stealth features to bypass bot detection.

## ⚡ Key Features

- **🚀 High Performance:** Keeps browser instances alive for 5-10x faster subsequent requests.
- **🥷 Stealth Mode:** Uses `playwright-extra` and `puppeteer-extra-plugin-stealth` to bypass Cloudflare and advanced bot detection.
- **🔌 MCP Protocol:** Fully supports Model Context Protocol (SSE/HTTP) for seamless LLM integration.
- **🌐 Proxy Support:** Built-in support for residential proxies to bypass site-specific IP blocking.
- **📦 Multi-Platform Docker:** Support for both `amd64` and `arm64` (Apple Silicon & Cloud VMs).

---

## 🛠 Prerequisites

- **Node.js:** v18.0.0 or higher (Required for ESM support)
- **Docker / Podman:** Required for containerized deployment
- **Git:** Required for cloning the repository

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
npx playwright install chromium
```

### 2. Run in HTTP/SSE Mode
```bash
npm run start:http
```

---

## ☁️ Deployment Guide (VM/Cloud - Rocky Linux/TencentOS)

### 1. Provision & Setup Git
```bash
# Install Git
sudo dnf install -y git

# Clone repository
git clone https://github.com/elon-jang/product-info-extractor-mcp.git
cd product-info-extractor-mcp
```

### 2. Option A: Docker / Podman (Recommended)

#### **Step 1: Install Container Engine**
```bash
# For Docker (Official Repo)
sudo dnf install -y yum-utils
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker && sudo systemctl enable docker

# For Podman (Native RHEL/TOS)
sudo dnf install -y podman
```

#### **Step 2: Run the Extractor**
If using **Podman** on older OS (Python < 3.8), use `podman run` directly:
```bash
# Docker
docker compose up -d

# Podman (Direct Run - Safest for older OS)
podman run -d -p 8080:3000 \
  -e PORT=3000 -e HOST=0.0.0.0 \
  --name product-info-extractor \
  docker.io/joomanba/product-info-extractor-mcp:latest
```

---

### 3. Option B: Manual Installation (npm)

Use this if you cannot use containers. Requires **Node.js v18+**.

```bash
# 1. Install Node.js v18+ (example using NodeSource)
# First, completely remove old versions and conflicting npm package
sudo dnf remove -y nodejs npm
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# 2. Install Playwright dependencies
sudo npx playwright install-deps

# 3. Setup Project
npm install
npx playwright install chromium

# 4. Start Server
npm run start:http
```

---

## 🧪 Testing the Deployment

Once the server is running at `http://<VM_IP>:8080/sse`:

### Method 1: Node.js Test Client (Full Extraction)
**Requires Node.js v18+ on the testing machine.**

```bash
# Install dependencies if not done
npm install

# Run test (default port 8080)
node test-mcp-http.js https://www.ugg.com/...
```

### Method 2: Shell Script (Connection Test)
```bash
./test-server.sh http://localhost:8080
```

---

## 🛠 Building the Image (Developers)

To build and push for multiple architectures (AMD64/ARM64):

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t joomanba/product-info-extractor-mcp:latest --push .
```

---

## 🔧 Claude Desktop Configuration

Update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "product-info-extractor": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://<YOUR_VM_IP>:8080/sse"]
    }
  }
}
```
