import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

chromium.use(stealthPlugin());

const url = process.argv[2] || "https://www.ugg.com/women-slippers/cozy-slipper/1117659.html";

async function debug() {
    console.log(`🔍 Diagnostic Start: ${url}`);

    const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    try {
        console.log("🚀 Navigating...");
        const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

        const status = response ? response.status() : "N/A";
        const title = await page.title();
        console.log(`📡 Status: ${status}`);
        console.log(`📡 Title: ${title}`);

        // Wait 5 seconds for any async content
        console.log("⏳ Waiting for content...");
        await page.waitForTimeout(5000);

        // Save Screenshot
        const screenshotPath = "debug_screenshot.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot saved: ${screenshotPath}`);

        // Save HTML
        const html = await page.content();
        const htmlPath = "debug_output.html";
        fs.writeFileSync(htmlPath, html);
        console.log(`📄 HTML saved: ${htmlPath}`);

        // Check for product nodes
        const h1 = await page.textContent('h1').catch(() => null);
        console.log(`📝 H1 Test: ${h1 ? h1.trim() : 'NOT FOUND'}`);

    } catch (error) {
        console.error("❌ Diagnostic Failed:", error.message);
    } finally {
        await browser.close();
        console.log("🏁 Diagnostic Finished");
    }
}

debug();
