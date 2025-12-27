/**
 * MCP Server용 Product Extractor (ESM)
 * - Playwright 브라우저 재사용
 * - 사이트별 설정 동적 import
 */

import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(stealthPlugin());
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProductExtractor {
  constructor() {
    this.browser = null;
    this.context = null;
    this.isInitialized = false;
    this.cache = new Map();
    this.cacheTTL = (parseInt(process.env.CACHE_TTL_MINUTES) || 30) * 60 * 1000; // Default 30 minutes
  }

  /**
   * 브라우저 초기화 (1회)
   */
  async init() {
    if (this.isInitialized) return;

    console.log("🚀 Initializing browser instance...");

    const proxyServer = process.env.PROXY_SERVER;
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;

    const launchArgs = {
      headless: true,
      args: [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    };

    if (proxyServer) {
      const redactedUser = proxyUsername ? `${proxyUsername.substring(0, 8)}...` : 'not set';
      console.log(`🌐 Using Proxy Server: ${proxyServer} (User: ${redactedUser})`);

      const proxyConfig = {
        server: proxyServer,
      };
      if (proxyUsername && proxyPassword) {
        proxyConfig.username = proxyUsername;
        proxyConfig.password = proxyPassword;
      }

      launchArgs.proxy = proxyConfig;
    }

    this.browser = await chromium.launch(launchArgs);
    this.browserVersion = await this.browser.version();

    const contextOptions = {
      ignoreHTTPSErrors: true, // Required for many residential proxies that perform SSL inspection
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2, // Retina-like scale for Mac
    };

    // Force proxy at context level as well
    if (proxyServer) {
      contextOptions.proxy = {
        server: proxyServer,
      };
      if (proxyUsername && proxyPassword) {
        contextOptions.proxy.username = proxyUsername;
        contextOptions.proxy.password = proxyPassword;
      }
    }

    this.context = await this.browser.newContext(contextOptions);

    // Stealth plugin handles navigator properties, so manual overrides are removed.

    this.isInitialized = true;
    console.log(`✅ Browser initialized (Version: ${this.browserVersion})`);
  }

  /**
   * 사이트 설정 로드 (ESM dynamic import)
   */
  async loadSiteConfig(url) {
    const sitesDir = process.env.SITES_DIR || path.join(__dirname, "../../product-info-extractor/sites");
    const hostname = new URL(url).hostname;
    const siteFiles = ["chanel.js", "ugg.js", "weverse.js", "chanel.mjs", "ugg.mjs", "weverse.mjs"];

    // Default configuration to use if everything else fails
    const defaultConfig = {
      loadSettings: {
        waitUntil: "networkidle",
        timeout: 30000
      },
      selectors: {
        name: ["h1"],
        price: [".price", "[itemprop='price']"],
        stock_text: [".stock", ".availability"]
      },
      customLogic: async () => ({ variants: [], sizes: [], current_color: null })
    };

    for (const file of siteFiles) {
      try {
        const moduleUrl = pathToFileURL(path.join(sitesDir, file)).href;
        const mod = await import(moduleUrl);
        const config = mod.default ?? mod;

        if (config.domains?.some((domain) => hostname.includes(domain))) {
          return config;
        }
      } catch (e) {
        // ignore and try next or fallback
      }
    }

    try {
      // fallback: base.mjs or base.js
      for (const baseFile of ["base.mjs", "base.js"]) {
        try {
          const baseUrl = pathToFileURL(path.join(sitesDir, baseFile)).href;
          const baseModule = await import(baseUrl);
          return baseModule.default ?? baseModule;
        } catch {
          continue;
        }
      }
    } catch {
      // fall through to default
    }

    console.log("⚠️ Site configuration not found, using default fallback.");
    return defaultConfig;
  }

  /**
   * 메인 추출 함수
   */
  async extract(url, options = {}) {
    const { compact = true } = options;
    const cacheKey = `${url}_${compact}`;

    // 1. Check Cache
    if (this.cache.has(cacheKey)) {
      const { data, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        console.log(`🎯 Cache Hit: ${url}`);
        return data;
      }
      this.cache.delete(cacheKey); // Expired
    }

    if (!this.isInitialized) {
      await this.init();
    }

    const siteConfig = await this.loadSiteConfig(url);

    let extractionAttempts = 0;
    let finalResult = null;

    while (extractionAttempts < 3) {
      let currentContext = null;
      let currentPage = null;
      let images, productInfo, customData;

      try {
        const browserMajorVersion = (this.browserVersion || "133").split('.')[0].replace(/[^0-9]/g, '');
        const cleanVersion = (this.browserVersion || "133").split('/').pop();

        // Fresh context per attempt for total isolation
        currentContext = await this.browser.newContext({
          ignoreHTTPSErrors: true,
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 2,
          locale: 'en-US',
          timezoneId: 'America/New_York', // Matches residential IP region
          colorScheme: 'light',
          userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${cleanVersion} Safari/537.36`,
          extraHTTPHeaders: {
            'sec-ch-ua': `"Chromium";v="${browserMajorVersion}", "Google Chrome";v="${browserMajorVersion}", "Not=A?Brand";v="99"`,
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'referer': 'https://www.google.com/',
          }
        });

        currentPage = await currentContext.newPage();

        currentPage.on('requestfailed', request => {
          const failure = request.failure();
          if (failure && (failure.errorText.includes('ERR_PROXY') || failure.errorText.includes('ERR_TUNNEL'))) {
            console.error(`❌ Network/Proxy failure for ${request.url()}: ${failure.errorText}`);
          }
        });

        // Diagnostic: Check current IP if proxy is enabled (DISABLED for stealth in real runs)
        // if (process.env.PROXY_SERVER && extractionAttempts === 0) { ... }

        // Random jitter before navigation to mimic human lead time
        await currentPage.waitForTimeout(Math.random() * 3000 + 2000);

        const response = await currentPage.goto(url, {
          waitUntil: 'networkidle', // Try to wait for full script execution
          timeout: 45000,
        }).catch(async () => {
          console.log("⚠️ Networkidle timeout, continuing with current state...");
          return null;
        });

        // "Observational" wait - let DataDome/Cloudflare scripts run/resolve
        await currentPage.waitForTimeout(5000);

        // Simulated mouse movement to trigger behavioral scripts
        try {
          await currentPage.mouse.move(Math.random() * 500, Math.random() * 500);
          await currentPage.waitForTimeout(500);
          await currentPage.mouse.move(Math.random() * 500, Math.random() * 500);
        } catch (mE) { /* Ignored */ }

        const cookies = await currentContext.cookies();
        const hasDataDomeCookie = cookies.some(c => c.name.toLowerCase().includes('datadome'));
        if (hasDataDomeCookie) console.log("🍪 DataDome cookie detected");

        const status = response ? response.status() : 'No Response';
        const title = await currentPage.title();

        console.log(`📡 [Attempt ${extractionAttempts + 1}] [${status}] Page Loaded: "${title}"`);

        // Handle blocking (403 or Cloudflare titles)
        if (status === 403 || title.toLowerCase().includes('just a moment') || title.toLowerCase().includes('cloudflare') || title.toLowerCase().includes('access denied')) {
          const htmlCapture = await currentPage.content().then(html => html.slice(0, 1000));
          console.log(`⚠️ Blocked (Status ${status}). Title: "${title}".`);
          console.log(`📄 HTML Snippet: "${htmlCapture.replace(/\n/g, ' ')}"`);
          throw new Error(`Cloudflare/Firewall Blocked (Status ${status})`);
        }

        // Human-like interaction: Multi-step Scroll (mimic a person reading/scanning)
        await currentPage.evaluate(() => {
          return new Promise(resolve => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
              if (totalHeight >= 600 || totalHeight >= scrollHeight) {
                clearInterval(timer);
                resolve();
              }
            }, 150);
          });
        });
        await currentPage.waitForTimeout(1500);

        // Wait for a core element (UGG specific or generic)
        if (url.includes('ugg.com')) {
          await currentPage.waitForSelector('h1, .product-detail', { timeout: 10000 }).catch(() => null);
        }

        [images, productInfo, customData] = await Promise.all([
          this.extractImages(currentPage, siteConfig),
          this.extractProductInfo(currentPage, siteConfig),
          typeof siteConfig.customLogic === "function"
            ? siteConfig.customLogic(currentPage)
            : Promise.resolve({ variants: [], sizes: [], current_color: null }),
        ]);

        if (!productInfo.name && extractionAttempts < 2) {
          throw new Error('Extraction failed (empty content)');
        }

        finalResult = {
          url,
          timestamp: new Date().toISOString(),
          site: siteConfig.name,
          product: {
            ...productInfo,
            variants: customData.variants,
            sizes: customData.sizes,
            current_color: customData.current_color,
            ...Object.fromEntries(
              Object.entries(customData).filter(
                ([k]) => !["variants", "sizes", "current_color"].includes(k)
              )
            ),
          },
          images: {
            main_product_image: images.main_product_image,
            total_count: images.total_images_count,
            grouped: images.grouped,
            high_resolution_recommended: images.high_resolution_recommended,
            all_images: images.all_images,
          },
        };

        if (typeof siteConfig.postExtractionHook === "function") {
          try {
            console.log(`🛠️ Running post-extraction hook for ${new URL(url).hostname}`);
            finalResult = await siteConfig.postExtractionHook(currentPage, finalResult, url);
          } catch (postError) {
            console.error("❌ Error in post-extraction hook:", postError.message);
          }
        }

        break; // Success
      } catch (e) {
        extractionAttempts++;
        console.log(`🔄 Attempt ${extractionAttempts} failed: ${e.message}`);

        if (extractionAttempts < 3) {
          const waitTime = extractionAttempts * 5000;
          console.log(`   Waiting ${waitTime}ms and retrying with fresh context...`);
          await new Promise(r => setTimeout(r, waitTime));
        } else {
          throw e;
        }
      } finally {
        if (currentPage) await currentPage.close().catch(() => null);
        if (currentContext) await currentContext.close().catch(() => null);
      }
    }

    // Diagnostic: Log body snippet if name is still missing
    if (finalResult && !finalResult.product.name) {
      console.log(`⚠️ Final extraction empty for URL: ${url}`);
    }

    // 4. Store in Cache and return
    const processedResult = compact ? this.getCompactResult(finalResult) : finalResult;
    this.cache.set(cacheKey, {
      data: processedResult,
      timestamp: Date.now(),
    });

    return processedResult;
  }

  /**
   * Compact 결과
   */
  getCompactResult(full) {
    const compact = {
      product: {
        name: full.product.name,
        price: full.product.price,
        in_stock: full.product.in_stock,
      },
      image_url: full.images.main_product_image,
    };

    let sizes = full.product.sizes;

    if (
      (!sizes || sizes.length === 0) &&
      full.product.dimensions?.includes("In Stock")
    ) {
      sizes = this.parseDimensionsStock(full.product.dimensions);
    }

    if (full.product.variants?.length) {
      compact.product.variants = full.product.variants.map((v) => {
        const variantSizes = v.sizes || sizes || [];
        return {
          color: v.color,
          color_code: v.color_code,
          image_url: v.image_url,
          sizes: variantSizes.map((s) => ({
            size: s.size,
            in_stock: s.available || s.in_stock,
          })),
        };
      });
    } else if (sizes?.length) {
      compact.product.sizes = sizes.map((s) => ({
        size: s.size,
        in_stock: s.available || s.in_stock,
      }));
    }

    return compact;
  }

  /**
   * Dimensions → 재고 파싱
   */
  parseDimensionsStock(text) {
    const sizes = [];
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      if (/^\d+(\.\d+)?$/.test(lines[i])) {
        const inStock = lines[i + 1] === "In Stock";
        sizes.push({
          size: lines[i],
          available: inStock,
          stock_text: inStock ? "In Stock" : "",
        });
        if (inStock) i++;
      }
    }

    return sizes;
  }

  /**
   * 이미지 추출
   */
  async extractImages(page, siteConfig) {
    const imageData = await page.evaluate(() => {
      const images = [];

      document.querySelectorAll("img").forEach((img) => {
        const src = img.src || img.dataset.src || img.dataset.originalSrc;
        if (src?.startsWith("http")) {
          images.push({
            url: src,
            alt: img.alt || "",
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0,
          });
        }
      });

      const og = document.querySelector('meta[property="og:image"]')?.content;
      if (og) images.push({ url: og, alt: "og:image", width: 0, height: 0 });

      return images;
    });

    const productKeywords = [
      "product",
      "item",
      "main",
      "hero",
      "zoom",
      "large",
      "detail",
      "gallery",
      "model",
      "packshot",
      "thumbnail",
      "swatch",
    ];
    const excludeKeywords = [
      "logo",
      "icon",
      "badge",
      "banner",
      "advertisement",
      "sprite",
      "button",
      "arrow",
      "star",
      "rating",
      "social",
      "payment",
      "footer",
      "noimage",
      "placeholder",
      "empty",
      "stylitics",
    ];

    const filtered = imageData.filter((img) => {
      const u = img.url.toLowerCase();
      const a = img.alt.toLowerCase();
      if (excludeKeywords.some((k) => u.includes(k) || a.includes(k)))
        return false;
      return productKeywords.some((k) => u.includes(k) || a.includes(k));
    });

    const sorted = [...filtered].sort(
      (a, b) => b.width * b.height - a.width * a.height
    );

    return {
      main_product_image:
        sorted[0]?.url || filtered[0]?.url || imageData[0]?.url || "",
      total_images_count: filtered.length,
      high_resolution_recommended: sorted.slice(0, 3).map((i) => i.url),
      grouped: { product: filtered.map((i) => i.url) },
      all_images: imageData.map((i) => i.url),
    };
  }

  /**
   * 상품 정보 추출
   */
  async extractProductInfo(page, siteConfig) {
    return page.evaluate((selectors) => {
      if (!selectors) {
        console.error('selectors is undefined in page.evaluate');
        return {};
      }
      const info = {};
      const ensureArray = (val) => Array.isArray(val) ? val : (val ? [val] : []);

      for (const s of ensureArray(selectors.name)) {
        const el = document.querySelector(s);
        if (el) {
          info.name = el.textContent?.trim();
          break;
        }
      }

      for (const s of ensureArray(selectors.price)) {
        const el = document.querySelector(s);
        if (el) {
          info.price = el.textContent?.trim();
          break;
        }
      }

      let stock = "";
      // Check both 'stock' and 'stock_text' for backward/new adapter compatibility
      const stockSelectors = ensureArray(selectors.stock || selectors.stock_text);
      for (const s of stockSelectors) {
        const el = document.querySelector(s);
        if (el) {
          stock = el.textContent?.trim();
          break;
        }
      }

      info.stock_text = stock;
      const lowerStock = stock.toLowerCase();

      // Robust stock detection logic
      const negativeKeywords = ["unavailable", "sold out", "out of stock", "품절", "일시 품절"];
      const positiveKeywords = ["in stock", "available", "add to bag", "add to cart", "장바구니"];

      let isAvailable = false;

      // 1. Check for negative keywords first
      const hasNegative = negativeKeywords.some(k => lowerStock.includes(k));

      if (hasNegative) {
        isAvailable = false;
      } else {
        // 2. Check for positive keywords, ensuring 'available' is not part of 'unavailable'
        isAvailable = positiveKeywords.some(k => {
          if (k === "available") {
            // Check if 'available' is preceded by 'un'
            return lowerStock.includes(k) && !lowerStock.includes("unavailable");
          }
          return lowerStock.includes(k);
        });
      }

      info.in_stock = isAvailable;

      // Price cleanup (remove redundant newlines and whitespace)
      if (info.price) {
        info.price = info.price.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      }

      for (const s of ensureArray(selectors.description)) {
        const el = document.querySelector(s);
        if (el) {
          info.description = el.textContent?.trim();
          break;
        }
      }

      return info;
    }, siteConfig.selectors);
  }

  /**
   * 브라우저 종료
   */
  async close() {
    if (this.browser) {
      console.log("🔌 Closing browser...");
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.isInitialized = false;
    }
  }
}

export default ProductExtractor;
