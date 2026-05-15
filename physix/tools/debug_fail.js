const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const searchUrl = 'https://pixabay.com/sound-effects/search/8-bit-jump-retro-game/';
  await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Try different selectors for result items
  const selectors = [
    'a[href^="/sound-effects/"]',
    '.container--rr0Uq a',
    '[data-testid="sound-effect-card"] a',
    'article a',
    '.result a',
  ];

  for (const sel of selectors) {
    const links = await page.evaluate((s) => {
      return Array.from(document.querySelectorAll(s))
        .map(a => a.getAttribute('href'))
        .filter(h => h && h.startsWith('/sound-effects/') && h.split('/').length > 2);
    }, sel);
    console.log(`Selector "${sel}":`, links.slice(0, 3));
  }

  // Also check for lazy-loaded content by scrolling
  await page.evaluate(() => window.scrollBy(0, 500));
  await new Promise(r => setTimeout(r, 2000));

  const afterScroll = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href^="/sound-effects/"]'))
      .map(a => a.getAttribute('href'))
      .filter(h => h && h.split('/').length > 2)
      .slice(0, 5);
  });
  console.log('After scroll:', afterScroll);

  await browser.close();
})();
