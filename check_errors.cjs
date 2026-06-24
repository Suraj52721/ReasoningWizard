const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error(`[PAGE ERROR] ${msg.text()}`);
        } else {
            console.log(`[PAGE LOG] ${msg.text()}`);
        }
    });

    page.on('pageerror', err => {
        console.error(`[UNCAUGHT EXCEPTION] ${err.message}`);
    });

    console.log('Navigating to http://localhost:5173/nvr-worksheets ...');
    try {
        await page.goto('http://localhost:5173/nvr-worksheets', { waitUntil: 'networkidle2', timeout: 10000 });
    } catch (e) {
        console.log('Navigation error: ' + e);
    }

    await browser.close();
})();
