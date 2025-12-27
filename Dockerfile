FROM node:18-slim

# Playwright 의존성 설치
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 생성
WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# Playwright 브라우저 설치
RUN npx playwright install chromium

# 소스 코드 복사
COPY src ./src
COPY sites ./sites

# 포트 노출
EXPOSE 3000

# 환경 변수
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV SITES_DIR=/app/sites

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# HTTP 서버 시작
CMD ["node", "src/server-http.js"]
