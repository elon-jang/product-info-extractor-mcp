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

    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-setuid-sandbox",
      ],
    });

    this.context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Upgrade-Insecure-Requests': '1',
      },
      permissions: ['geolocation'],
      geolocation: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    });

    // Stealth plugin handles navigator properties, so manual overrides are removed.

    this.isInitialized = true;
    console.log("✅ Browser initialized");
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
    const page = await this.context.newPage();

    try {
      try {
        const response = await page.goto(url, {
          waitUntil: siteConfig.loadSettings.waitUntil,
          timeout: siteConfig.loadSettings.timeout,
        });

        const status = response ? response.status() : 'No Response';
        const title = await page.title();
        console.log(`📡 [${status}] Page Loaded: "${title}"`);

        // Check for common blocking indicators
        if (title.toLowerCase().includes('just a moment') || title.toLowerCase().includes('cloudflare') || title.toLowerCase().includes('access denied')) {
          console.warn('⚠️  Cloudflare/Bot detection detected in page title!');
        }
      } catch (e) {
        console.log(`⚠️ Page load error: ${e.message}`);
      }

      await page.waitForTimeout(siteConfig.loadSettings.waitAfterLoad || 0);

      const [images, productInfo, customData] = await Promise.all([
        this.extractImages(page, siteConfig),
        this.extractProductInfo(page, siteConfig),
        typeof siteConfig.customLogic === "function"
          ? siteConfig.customLogic(page)
          : Promise.resolve({ variants: [], sizes: [], current_color: null }),
      ]);

      // Diagnostic: Log body snippet if name is missing
      if (!productInfo.name) {
        const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 500));
        console.log(`⚠️  Extraction empty. Body snippet: "${bodySnippet.replace(/\n/g, ' ')}"`);
      }

      let result = {
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

      // 3. Execute site-specific post-processing hook if it exists
      if (typeof siteConfig.postExtractionHook === "function") {
        try {
          console.log(`🛠️ Running post-extraction hook for ${new URL(url).hostname}`);
          result = await siteConfig.postExtractionHook(page, result, url);
        } catch (e) {
          console.error("❌ Error in post-extraction hook:", e.message);
        }
      }

      // 4. Store in Cache
      const finalResult = compact ? this.getCompactResult(result) : result;
      this.cache.set(cacheKey, {
        data: finalResult,
        timestamp: Date.now(),
      });

      return finalResult;
    } finally {
      if (page) await page.close();
    }
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
