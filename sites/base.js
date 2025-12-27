export default {
    loadSettings: {
        waitUntil: "networkidle",
        timeout: 30000
    },
    selectors: {
        name: "h1",
        price: ".price, [itemprop='price']",
        stock_text: ".stock, .availability"
    }
};
