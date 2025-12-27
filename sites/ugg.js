/**
 * UGG.com Config & Extraction Adapter
 */
export default {
    domains: ["ugg.com"],
    loadSettings: {
        waitUntil: "load", // 'networkidle' is too slow for UGG (lots of background noise)
        timeout: 30000,
    },
    selectors: {
        name: "h1",
        price: ".product-detail .price, .product-primary-attributes .price",
        description: ".product-description, #collapsible-details-1",
        main_image: ".product-detail .primary-image, .product-primary-attributes img",
        stock_text: ".add-to-cart, .btn-primary",
    },

    /**
     * UGG-specific post-extraction processing
     */
    async postExtractionHook(page, result, url) {
        // 1. Price Cleanup
        if (result.product.price) {
            const priceMatch = result.product.price.match(/\$\d+(\.\d+)?/);
            if (priceMatch) {
                result.product.price = priceMatch[0];
            }
        }

        // 2. Image Selection (Heuristic-based)
        const uggCDNs = ['dms.deckers.com', 'deckers.coremedia.cloud'];
        const isUggImage = (img) => uggCDNs.some(cdn => img.includes(cdn)) && !img.includes('stylitics') && !img.includes('noimagelarge');

        const getScore = (img) => {
            let score = 0;
            if (img.match(/_1\.(png|jpg|webp)/)) score += 10;
            if (img.match(/_2\.(png|jpg|webp)/)) score += 5;
            if (img.match(/_\d+\.(png|jpg|webp)/)) score += 2;
            if (img.includes('large') || img.includes('hero') || img.includes('primary')) score += 1;
            return score;
        };

        const candidates = result.images.all_images.filter(isUggImage);
        const bestImage = candidates.sort((a, b) => getScore(b) - getScore(a))[0];
        if (bestImage) {
            result.images.main_product_image = bestImage;
        }

        // 3. Robust Per-Variant Stock & Images
        try {
            const mainContainer = await page.evaluate(() => {
                const primary = document.querySelector('.product-primary-attributes');
                if (primary) return '.product-primary-attributes';
                const allData = Array.from(document.querySelectorAll('.product-data'));
                if (allData.find(d => d.querySelector('h1'))) return '.product-data';
                return '.product-detail';
            });

            const swatches = await page.evaluate((selector) => {
                const container = document.querySelector(selector);
                if (!container) return [];

                // Only identify swatches that are actually visible to the user
                const buttons = Array.from(container.querySelectorAll('.swatch-circle, .swatch-square, .color-attribute button, [data-attr="color"] button'));
                return buttons
                    .filter(btn => {
                        const rect = btn.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(btn).display !== 'none';
                    })
                    .map(btn => {
                        const title = btn.getAttribute('title') || btn.getAttribute('aria-label') || btn.innerText.trim();
                        const url = btn.getAttribute('value') || btn.getAttribute('data-url');
                        return { title, url };
                    }).filter(s => s.url);
            }, mainContainer);

            if (swatches.length > 0) {
                const variantsData = await page.evaluate(async (swatchList) => {
                    const fetchWithRetry = async (swatch, retries = 1) => {
                        const varUrl = swatch.url.startsWith('/') ? window.location.origin + swatch.url : swatch.url;
                        const imgUrl = varUrl.replace('/Product-Variation', '/Component-GetSliderImages') + '&includeImages=true';
                        const headers = { 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest' };

                        try {
                            const [resVar, resImg] = await Promise.all([
                                fetch(varUrl, { headers }),
                                fetch(imgUrl, { headers })
                            ]);
                            const [dataVar, dataImg] = await Promise.all([resVar.json(), resImg.json()]);

                            if (!dataVar?.product?.variationAttributes) return null;

                            const sizeAttr = dataVar.product.variationAttributes.find(a =>
                                ['size', 'Size'].includes(a.id || a.attributeId || '') ||
                                (a.displayName && a.displayName.toLowerCase().includes('size'))
                            );

                            const sizes = sizeAttr ? sizeAttr.values.map(v => ({
                                size: v.displayValue || v.id,
                                available: v.selectable === true || v.selectable === 'true' ||
                                    (v.availability && (v.availability.type === 'instock' || v.availability.status?.includes('IN')))
                            })) : [];

                            let highResImg = null;
                            if (dataImg.images) {
                                if (dataImg.images.pdpSliderLarge) highResImg = dataImg.images.pdpSliderLarge[0]?.url;
                                else if (Array.isArray(dataImg.images) && dataImg.images.length > 0) highResImg = dataImg.images[0].url;
                            }

                            return {
                                color: swatch.title,
                                image_url: highResImg,
                                sizes: sizes,
                                price: dataVar.product.price?.sales?.formatted || null,
                                in_stock: dataVar.product.available
                            };
                        } catch (e) {
                            if (retries > 0) return fetchWithRetry(swatch, retries - 1);
                            return null;
                        }
                    };

                    // Parallel fetching with small batches to balance speed and bot safety
                    const results = [];
                    const batchSize = 3;
                    for (let i = 0; i < swatchList.length; i += batchSize) {
                        const batch = swatchList.slice(i, i + batchSize);
                        const batchResults = await Promise.all(batch.map(s => fetchWithRetry(s)));
                        results.push(...batchResults);
                        if (i + batchSize < swatchList.length) await new Promise(r => setTimeout(r, 100));
                    }
                    return results;
                }, swatches);

                result.product.variants = variantsData.filter(v => v !== null);
            }
        } catch (e) {
            console.warn('⚠️ UGG site-specific extraction failed:', e.message);
        }

        return result;
    }
};
