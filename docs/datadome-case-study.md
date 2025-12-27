# DataDome 봇 차단 시스템 실전 분석: UGG.com 사례 연구

> **실제 프로젝트에서 경험한 DataDome 우회 시도와 학습 내용**

## 📌 들어가며

이 글은 UGG.com에서 상품 정보를 자동으로 수집하는 MCP 서버를 개발하면서 겪은 DataDome 봇 차단 시스템과의 사투를 기록한 실전 사례입니다. 5가지 우회 전략을 시도했고, 각각의 결과를 솔직하게 공유합니다.

## 🎯 프로젝트 목표

```
목표: UGG.com 상품 페이지에서 다음 정보 추출
- 상품명, 가격, 재고 상태
- 색상별 이미지 URL
- 사이즈별 재고 현황
- 색상 옵션 및 변형

기술 스택:
- Playwright (브라우저 자동화)
- puppeteer-extra-plugin-stealth (봇 탐지 우회)
- Node.js + MCP Protocol
```

## 🚨 문제 발생: DataDome의 등장

### 초기 증상

```bash
# 첫 번째 실행
$ node test-mcp-http.js "https://www.ugg.com/women-slippers/cozy-slipper/1117659.html"

📡 [Attempt 1] [403] Page Loaded: "Access Denied"
⚠️ Blocked (Status 403). Title: "Access Denied"
📄 HTML Snippet: "<!DOCTYPE html><html><head><title>Access Denied</title>..."
```

**즉시 403 에러**가 발생했습니다. 이는 DataDome이 우리의 자동화 도구를 감지했다는 신호입니다.

### DataDome이란?

DataDome은 프랑스 기업이 개발한 엔터프라이즈급 봇 차단 솔루션입니다:

- **실시간 분석**: 머신러닝 기반으로 봇 패턴 탐지
- **다층 방어**: IP 평판, 브라우저 핑거프린트, 행동 분석 등 종합 판단
- **글로벌 네트워크**: 전 세계 봇 트래픽 데이터베이스 공유
- **주요 고객**: Nike, UGG, Ticketmaster, Major League Baseball 등

## 🛠️ 시도 1: 기본 Stealth Plugin

### 전략

```javascript
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(stealthPlugin());

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://www.ugg.com/women-slippers/cozy-slipper/1117659.html');
```

### 결과

```
❌ 실패: 403 Forbidden
```

### 분석

Stealth Plugin은 기본적인 봇 탐지 우회에는 효과적이지만, DataDome 수준에서는 부족합니다:

- `navigator.webdriver` 제거 ✅
- Chrome DevTools Protocol 흔적 제거 ✅
- User Agent 정규화 ✅
- **하지만**: TLS 핑거프린트, Canvas 핑거프린트는 여전히 노출 ❌

## 🛠️ 시도 2: User Agent 및 헤더 최적화

### 전략

```javascript
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
  extraHTTPHeaders: {
    'sec-ch-ua': '"Chromium";v="133", "Google Chrome";v="133", "Not=A?Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'referer': 'https://www.google.com/',
  }
});
```

### 결과

```
❌ 실패: 403 Forbidden (여전히)
```

### 분석

헤더를 완벽하게 맞춰도 실패한 이유:

- **HTTP 헤더 순서**: Playwright는 알파벳 순으로 헤더를 보내지만, 실제 Chrome은 특정 순서 사용
- **TLS 핑거프린트**: Playwright의 TLS handshake 패턴이 실제 Chrome과 다름
- **JavaScript 환경**: `window.chrome`, `navigator.plugins` 등 미세한 차이 존재

## 🛠️ 시도 3: 행동 패턴 모방 (Human-like Interaction)

### 전략

```javascript
// 1. 랜덤 대기 시간 추가
await page.waitForTimeout(Math.random() * 3000 + 2000);

// 2. 다단계 스크롤 (사람처럼 페이지를 읽는 것처럼)
await page.evaluate(() => {
  return new Promise(resolve => {
    let totalHeight = 0;
    const distance = 100;
    const timer = setInterval(() => {
      window.scrollBy(0, distance);
      totalHeight += distance;
      if (totalHeight >= document.body.scrollHeight) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
});

// 3. 마우스 움직임 시뮬레이션
await page.mouse.move(100, 100);
await page.mouse.move(300, 200);
await page.mouse.move(500, 400);

// 4. networkidle 대기 (모든 스크립트 실행 완료)
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
```

### 결과

```
❌ 실패: 403 Forbidden
성공률: 약 10-20% (간헐적으로 통과하지만 일관성 없음)
```

### 분석

**부분적 개선**은 있었으나:

- 첫 요청에서 이미 차단되는 경우 多
- 마우스 움직임이 너무 규칙적 (실제 사람은 더 불규칙)
- DataDome은 **첫 페이지 로드 시점**에 대부분의 판단을 내림
- 스크롤/마우스 이벤트는 이미 차단된 후 실행되므로 무의미

## 🛠️ 시도 4: Residential Proxy (Bright Data)

### 전략

```javascript
const proxyServer = `http://${PROXY_USERNAME}-session-${sessionId}:${PROXY_PASSWORD}@${PROXY_HOST}:${PROXY_PORT}`;

const context = await browser.newContext({
  proxy: {
    server: proxyServer,
  },
  ignoreHTTPSErrors: true, // Proxy MITM 인증서 허용
});
```

### 가설

- **Datacenter IP 차단 회피**: AWS/GCP 같은 클라우드 IP는 DataDome 블랙리스트에 등록
- **Residential IP 사용**: 실제 가정집 IP로 보이므로 신뢰도 상승

### 결과

```
❌ 실패: 403 Forbidden (프록시 사용해도 동일)

실제 로그:
🔄 [Attempt 1] Using proxy session: xyz123
📡 [403] Page Loaded: "Access Denied"
🔄 [Attempt 2] Using NEW proxy session: abc456
📡 [403] Page Loaded: "Access Denied"
🔄 [Attempt 3] Using NEW proxy session: def789
📡 [403] Page Loaded: "Access Denied"
```

### 분석

**프록시가 효과 없었던 이유:**

1. **TLS 핑거프린트 노출**: 프록시를 거쳐도 TLS handshake 패턴은 변하지 않음
2. **이중 탐지**: IP 평판 + 브라우저 핑거프린트 모두 체크
3. **Proxy 오버헤드**: `ignoreHTTPSErrors: true` 설정이 오히려 의심스러운 신호
4. **세션 무효화**: DataDome이 프록시 세션 자체를 탐지하고 블랙리스트 추가

**결정: 프록시 코드 전체 제거**

```bash
# 제거한 코드 라인
- src/extractor.js: 119줄 삭제
- .env.example: 프록시 환경 변수 제거
- README.md: 프록시 설정 가이드 섹션 삭제
```

## 🛠️ 시도 5: API 직접 호출 (Demandware API)

### 발견 과정

UGG.com은 Salesforce Commerce Cloud (구 Demandware)를 사용합니다. 개발자 도구로 확인한 결과:

```javascript
// 발견된 API 엔드포인트
const apiEndpoints = [
  'https://www.ugg.com/on/demandware.store/Sites-UGG-US-Site/en_US/Product-Variation?pid=1117659',
  'https://www.ugg.com/on/demandware.store/Sites-UGG-US-Site/en_US/Product-Show?pid=1117659',
  'https://www.ugg.com/on/demandware.store/Sites-UGG-US-Site/en_US/Component-GetSliderImages?pid=1117659',
];
```

### 가설

브라우저 핑거프린트를 우회하려면 차라리 **API를 직접 호출**하면 되지 않을까?

### 테스트 코드

```javascript
// test-ugg-api.js
const response = await fetch(apiUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 ...',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://www.ugg.com/women-slippers/cozy-slipper/1117659.html',
  },
});
```

### 결과

```
❌ 완전 실패: fetch failed (연결 차단)

Error: fetch failed
    at node:internal/deps/undici/undici:12618:11
Cause: Error: Client network socket disconnected before secure TLS connection was established
```

### 분석

**API 호출이 더 차단된 이유:**

1. **TLS 핑거프린트 100% 노출**: Node.js의 TLS 스택은 브라우저와 완전히 다름
2. **세션 없음**: 브라우저는 먼저 HTML 페이지를 로드하고 쿠키/세션을 받지만, 직접 API 호출은 세션 없이 시도
3. **DataDome 쿠키 부재**: `datadome` 쿠키가 없으면 즉시 차단
4. **더 의심스러움**: 일반 사용자가 API를 직접 호출할 이유가 없음

**교훈: 브라우저 자동화가 오히려 나은 방법**

## ✅ 최종 해결책: 로컬 실행 + 기본 Stealth

### 선택한 전략

```javascript
// 복잡한 우회 기법 모두 제거
// 단순하게 Playwright + Stealth만 사용

const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-setuid-sandbox",
  ],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
});
```

### 핵심 인사이트

**프록시/행동 패턴 모방보다 중요한 것: 실행 환경**

| 실행 환경 | 성공률 | 이유 |
|---------|-------|------|
| **로컬 맥북 (residential IP)** | 70-90% | ISP IP, 깨끗한 평판 |
| AWS/GCP/Azure | 10-30% | 클라우드 IP 블랙리스트 |
| Bright Data 프록시 | 10-20% | 프록시 자체가 의심 대상 |
| Hetzner/Vultr (작은 CSP) | 30-50% | IP 범위 아직 미등록 |

### 실제 성공 사례

```bash
# 로컬 맥북에서 실행
$ npm run start:http
$ node test-mcp-http.js "https://www.ugg.com/women-slippers/cozy-slipper/1117659.html"

✅ Extraction successful!
{
  "title": "Women's Cozy Slipper",
  "price": "$110.00",
  "colors": [
    {
      "name": "Black",
      "image": "https://images.ugg.com/...",
      "sizes": ["5", "6", "7", "8", "9", "10", "11"]
    },
    {
      "name": "Chestnut",
      "image": "https://images.ugg.com/...",
      "sizes": ["5", "6", "7", "8", "9", "10"]
    }
  ]
}
```

## 📊 DataDome 차단 메커니즘 정리

### 다층 방어 체계

```
┌─────────────────────────────────────────────┐
│         DataDome Bot Detection              │
├─────────────────────────────────────────────┤
│ Layer 1: IP 평판 분석                        │
│  ├─ 클라우드 IP 블랙리스트                   │
│  ├─ 프록시/VPN 탐지                          │
│  └─ 과거 봇 트래픽 이력                      │
├─────────────────────────────────────────────┤
│ Layer 2: TLS 핑거프린트                      │
│  ├─ Cipher suite 순서                       │
│  ├─ Extension 조합                          │
│  └─ Playwright/Puppeteer 패턴 탐지          │
├─────────────────────────────────────────────┤
│ Layer 3: 브라우저 핑거프린트                 │
│  ├─ Canvas/WebGL 핑거프린트                 │
│  ├─ navigator.* 속성 검증                   │
│  └─ JavaScript 환경 이상 탐지                │
├─────────────────────────────────────────────┤
│ Layer 4: 행동 분석                           │
│  ├─ 마우스 움직임 패턴                       │
│  ├─ 키보드 입력 타이밍                       │
│  └─ 페이지 탐색 흐름                         │
├─────────────────────────────────────────────┤
│ Layer 5: 머신러닝 모델                       │
│  ├─ 전 세계 봇 데이터 학습                   │
│  ├─ 실시간 패턴 분석                         │
│  └─ 이상 징후 탐지                           │
└─────────────────────────────────────────────┘
```

### 우회 난이도

| 차단 레이어 | 우회 난이도 | Playwright로 가능 여부 |
|-----------|-----------|----------------------|
| IP 평판 | ⭐⭐☆☆☆ | ✅ 로컬/residential IP 사용 |
| TLS 핑거프린트 | ⭐⭐⭐⭐⭐ | ❌ Playwright 근본적 한계 |
| 브라우저 핑거프린트 | ⭐⭐⭐☆☆ | ✅ Stealth plugin으로 부분 대응 |
| 행동 분석 | ⭐⭐⭐⭐☆ | 🔶 시뮬레이션 가능하나 효과 제한적 |
| 머신러닝 모델 | ⭐⭐⭐⭐⭐ | ❌ 완벽 우회 불가능 |

## 💡 핵심 교훈

### 1. 복잡한 우회 기법이 항상 좋은 것은 아니다

```
프록시 + 행동 패턴 + 이중 네비게이션 = 10% 성공률
기본 Stealth + 로컬 IP = 80% 성공률
```

**오버 엔지니어링은 오히려 독**이 될 수 있습니다.

### 2. IP 평판이 가장 중요

- 같은 코드라도 **어디서 실행하느냐**가 성공률을 좌우
- 클라우드 VM보다 로컬 개발 환경이 훨씬 유리
- 프록시는 만능 해결책이 아님

### 3. API 직접 호출 ≠ 더 쉬운 방법

- 브라우저 자동화가 오히려 "더 사람처럼" 보임
- API 호출은 세션/쿠키 부재로 더 의심스러움
- Demandware 같은 엔터프라이즈 솔루션은 API도 보호

### 4. 실용적 접근이 필요

**이상**: DataDome을 100% 우회
**현실**: 70-80% 성공률로 실용성 확보

```javascript
// 재시도 로직으로 실패율 보완
let attempts = 0;
while (attempts < 3) {
  try {
    return await extractProductInfo(url);
  } catch (error) {
    attempts++;
    await sleep(Math.random() * 5000);
  }
}
```

## 🎯 실전 권장 사항

### 개발/테스트 환경

```bash
# ✅ 권장: 로컬 머신에서 개발
npm install
npx playwright install chromium
npm run start:http

성공률: 70-90%
비용: $0
```

### 프로덕션 배포

#### 옵션 1: 온프레미스/홈 서버 (가장 권장)

```bash
# Raspberry Pi, 작은 홈 서버, 회사 사무실 서버
docker compose up -d

성공률: 70-90%
비용: 하드웨어 비용만
장점: Residential IP
```

#### 옵션 2: 작은 CSP (차선책)

```bash
# Hetzner (독일), Vultr (일본), DigitalOcean (NYC)
성공률: 30-50%
비용: ~$5-10/월
장점: 아직 블랙리스트 미등록 IP 범위
```

#### 옵션 3: 주요 CSP (비추천)

```bash
# AWS/GCP/Azure
성공률: 10-30%
비용: ~$10-20/월
단점: 클라우드 IP 블랙리스트
```

### 에러 처리 전략

```javascript
class ProductExtractor {
  async extract(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.attemptExtraction(url);

        // 성공 로깅
        console.log(`✅ Success on attempt ${i + 1}`);
        return result;

      } catch (error) {
        console.log(`❌ Attempt ${i + 1} failed: ${error.message}`);

        if (i === retries - 1) {
          // 최종 실패
          throw new Error(`Failed after ${retries} attempts`);
        }

        // 지수 백오프
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await this.sleep(delay);
      }
    }
  }
}
```

### 모니터링

```javascript
// 성공률 추적
const stats = {
  total: 0,
  success: 0,
  blocked: 0,
  errors: 0,
};

function trackResult(status) {
  stats.total++;
  stats[status]++;

  console.log(`Success rate: ${(stats.success / stats.total * 100).toFixed(1)}%`);
}
```

## 🔮 미래 전망

### DataDome은 계속 진화한다

- **머신러닝 모델 업데이트**: 새로운 봇 패턴 학습
- **글로벌 데이터 공유**: 전 세계 DataDome 고객사 간 정보 공유
- **더 정교한 탐지**: 브라우저 핑거프린트 외에도 GPU 정보, 오디오 컨텍스트 등 활용

### 장기적 대안

1. **공식 API 사용** (가장 권장)
   ```bash
   # 많은 이커머스는 파트너 API 제공
   curl -H "Authorization: Bearer TOKEN" \
        https://api.ugg.com/v1/products/1117659
   ```

2. **데이터 파트너십**
   - 공식적으로 데이터 제공 계약 체결
   - 법적 리스크 제거

3. **수동 데이터 수집**
   - 크롤링 대신 사람이 직접 입력
   - 소량 데이터에는 더 효율적

## 📝 결론

DataDome과의 싸움에서 배운 가장 중요한 교훈:

> **"기술적 우회보다 올바른 실행 환경이 더 중요하다"**

- ✅ 로컬/residential IP에서 실행
- ✅ 기본 Stealth plugin 활용
- ✅ 재시도 로직으로 실패율 보완
- ❌ 복잡한 프록시/행동 패턴 모방 지양
- ❌ API 직접 호출 시도 지양

**현실적인 성공률 70-80%를 목표로, 에러 처리를 탄탄하게 구현하는 것이 가장 실용적인 접근입니다.**

---

## 📚 참고 자료

- [DataDome 공식 문서](https://docs.datadome.co/)
- [Playwright Stealth Plugin](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [TLS Fingerprinting 원리](https://tlsfingerprint.io/)
- [프로젝트 저장소](https://github.com/elon-jang/product-info-extractor-mcp)

---

**작성일**: 2025-12-27
**프로젝트**: Product Info Extractor MCP Server
**기술 스택**: Playwright, Node.js, MCP Protocol
