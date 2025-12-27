import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

const testUrls = [
    'https://httpbin.org/ip',               // Simple IP check
    'https://www.google.com',              // Big site, usually lenient
    'https://www.ugg.com',                 // Target site (Cloudflare)
    'https://www.weverseshop.io',          // Target site
    'https://bot.sannysoft.com/'           // Stealth check
];

async function runDiagnostics() {
    console.log('🔍 Starting IP Reputation & Stealth Diagnostics...');
    const browser = await chromium.launch({ headless: true });

    for (const url of testUrls) {
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            console.log(`\n🌐 Testing: ${url}`);
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const status = response.status();
            const title = await page.title();

            console.log(`✅ Status: [${status}]`);
            console.log(`📝 Title: "${title}"`);

            if (status >= 400) {
                const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 200));
                console.log(`⚠️ Blocked/Error Body: "${bodySnippet.replace(/\n/g, ' ')}"`);
            }
        } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
        } finally {
            await context.close();
        }
    }

    await browser.close();
    console.log('\n✅ Diagnostics complete.');
}

runDiagnostics();
