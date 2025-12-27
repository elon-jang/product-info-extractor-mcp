/**
 * Chanel.js Config Adapter
 */
export default {
    domains: ["chanel.com"],
    loadSettings: {
        waitUntil: "networkidle",
        timeout: 30000,
    },
    selectors: {
        name: "h1, .product-title",
        price: ".product-price, .price",
        description: ".product-description, .product-details",
        main_image: ".product-image img, #main-image",
        stock_text: ".add-to-cart, .availability",
    }
};
