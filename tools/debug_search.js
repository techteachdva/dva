const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const url = 'https://pixabay.com/sound-effects/search/8-bit-jump-retro-game/';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await new Promise(r => setTimeout(r, 5000));

  console.log('Title:', await page.title());
  const html = await page.content();
  console.log('Has result link:', html.includes('/sound-effects/') && !html.includes('/search/'));

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .filter(a => {
        const href = a.getAttribute('href') || '';
        return href.includes('/sound-effects/') && !href.includes('/search/');
      })
      .slice(0, 5)
      .map(a => ({
        href: a.getAttribute('href'),
        text: a.textContent.trim().slice(0, 40),
      }));
  });
  console.log('Links found:', JSON.stringify(links, null, 2));

  await browser.close();
})();
