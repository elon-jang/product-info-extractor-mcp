# Product Info Extractor MCP Server

> 🇰🇷 한국어 | 🇺🇸 **[English](README.en.md)**

이커머스 웹사이트에서 상품 정보(가격, 재고, 이미지, 색상별 사이즈 등)를 자동으로 추출하는 MCP 서버입니다.

> **⚠️ 중요:** DataDome 같은 고급 봇 차단 시스템은 자동 접근을 차단할 수 있습니다. 성공률은 대상 사이트와 네트워크 환경에 따라 다릅니다.

## 🚀 빠른 시작 (30초)

### Docker로 실행 (권장)

```bash
# 저장소 클론
git clone https://github.com/elon-jang/product-info-extractor-mcp.git
cd product-info-extractor-mcp

# 서버 시작
docker compose up -d

# 테스트
npm install
node test-mcp-http.js "https://www.ugg.com/women-slippers/cozy-slipper/1117659.html"
```

### 로컬 개발 모드

```bash
npm install
npx playwright install chromium
npm run start:http
```

---

## 📋 주요 기능

- **🚀 고성능:** 브라우저 인스턴스 재사용으로 5-10배 빠른 후속 요청
- **🥷 스텔스 모드:** `playwright-extra` + `puppeteer-extra-plugin-stealth`로 기본 봇 탐지 우회
- **🔌 MCP 프로토콜:** Claude Desktop과 바로 연동 가능
- **📦 멀티 플랫폼:** AMD64 + ARM64 (Apple Silicon & 클라우드 VM) 지원

---

## 🐳 Docker 배포 가이드

### 1. Docker 설치

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

### 2. 서버 실행

```bash
# Docker Compose로 실행 (권장)
docker compose up -d

# 또는 docker run으로 실행
docker run -d -p 8080:3000 \
  -e PORT=3000 -e HOST=0.0.0.0 \
  --name product-info-extractor \
  joomanba/product-info-extractor-mcp:latest
```

### 3. 상태 확인

```bash
# 컨테이너 로그 확인
docker logs -f product-info-extractor

# Health check
curl http://localhost:8080/health
```

---

## 🧪 테스트

### Node.js 테스트 클라이언트

```bash
npm install
node test-mcp-http.js "https://www.ugg.com/women-slippers/cozy-slipper/1117659.html"
```

### Shell 스크립트 (간단한 연결 테스트)

```bash
./test-server.sh http://localhost:8080
```

---

## 🔧 Claude Desktop 연동

`claude_desktop_config.json`에 추가:

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

## ⚠️ 제한 사항

### 봇 차단 시스템

다음 시스템들은 자동 접근을 차단할 수 있습니다:

- **DataDome** (UGG.com 사용): 성공률이 환경에 따라 변동
- **Cloudflare Advanced**: 추가 우회 기법 필요
- **PerimeterX**: 우회 매우 어려움

### 권장 사항

✅ 프로덕션 전 충분한 테스트
✅ 가능하면 공식 API 사용
✅ 재시도 로직 및 에러 처리 구현
✅ 성공률 모니터링

---

## 📚 고급 가이드

### Podman 환경 (RHEL/CentOS)

```bash
# Podman 설치
sudo dnf install -y podman

# 실행
podman run -d -p 8080:3000 \
  -e PORT=3000 -e HOST=0.0.0.0 \
  --name product-info-extractor \
  docker.io/joomanba/product-info-extractor-mcp:latest
```

### 수동 설치 (Docker 없이)

```bash
# Node.js v18+ 설치
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Playwright 의존성
sudo npx playwright install-deps

# 프로젝트 설정
npm install
npx playwright install chromium

# 서버 시작
npm run start:http
```

### 이미지 빌드 (개발자용)

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t joomanba/product-info-extractor-mcp:latest --push .
```

---

## 📄 라이선스

MIT License
