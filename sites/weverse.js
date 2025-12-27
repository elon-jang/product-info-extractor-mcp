/**
 * Weverse.js Config Adapter
 */
export default {
    domains: ["weverse.io", "shop.weverse.io"],
    loadSettings: {
        waitUntil: "networkidle",
        timeout: 30000,
    },
    selectors: {
        name: "h1, [class*='ProductName']",
        price: "[class*='Price'], .price",
        description: "[class*='Description'], .details",
        main_image: "[class*='MainImage'] img, .product-main-image img",
        stock_text: "[class*='BuyButton'], .btn-buy",
    }
};
