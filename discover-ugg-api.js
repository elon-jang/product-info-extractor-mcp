/**
 * Playwright로 UGG 사이트에 접속해서 실제 API 호출 캡처
 */
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(stealthPlugin());

async function discoverAPIs() {
  console.log('🔍 Discovering UGG API calls with Playwright...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // API 호출 캡처
  const apiCalls = [];

  page.on('request', (request) => {
    const url = request.url();
    // Demandware API 호출 필터링
    if (url.includes('/demandware.store/') || url.includes('/Product-') || url.includes('/Component-')) {
      apiCalls.push({
        method: request.method(),
        url,
        headers: request.headers(),
        postData: request.postData(),
      });
      console.log(`📡 API Call: ${request.method()} ${url}`);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/demandware.store/') || url.includes('/Product-') || url.includes('/Component-')) {
      console.log(`📥 Response: ${response.status()} ${url}`);

      try {
        const contentType = response.headers()['content-type'];
        if (contentType?.includes('json')) {
          const json = await response.json();
          console.log('JSON Response (first 500 chars):');
          console.log(JSON.stringify(json, null, 2).substring(0, 500));
          console.log('---\n');
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  console.log('Navigating to UGG product page...');
  await page.goto('https://www.ugg.com/women-slippers/cozy-slipper/1117659.html', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  console.log('\n✅ Page loaded. Waiting 5 seconds for additional API calls...');
  await page.waitForTimeout(5000);

  console.log(`\n📊 Total API calls captured: ${apiCalls.length}`);

  if (apiCalls.length > 0) {
    console.log('\n📋 Summary of API calls:');
    apiCalls.forEach((call, index) => {
      console.log(`\n${index + 1}. ${call.method} ${call.url}`);
      console.log(`   Headers:`, JSON.stringify(call.headers, null, 2).substring(0, 200));
      if (call.postData) {
        console.log(`   POST Data: ${call.postData.substring(0, 200)}`);
      }
    });
  }

  await browser.close();
}

discoverAPIs().catch(console.error);
