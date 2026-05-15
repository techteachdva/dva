const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const url = 'https://pixabay.com/sound-effects/film-special-effects-8-bit-jump-001-171817/';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await new Promise(r => setTimeout(r, 8000));

  console.log('Title:', await page.title());

  const audioSrc = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    if (audio) return { src: audio.src, innerHTML: audio.innerHTML };
    const sources = document.querySelectorAll('audio source');
    for (const s of sources) if (s.src) return { src: s.src };
    return null;
  });
  console.log('Audio:', audioSrc);

  const html = await page.content();
  const mp3Matches = html.match(/https?:\/\/[^\s\"\'\<\>]+\.mp3[^\s\"\'\<\>]*/g);
  console.log('MP3 URLs:', mp3Matches ? mp3Matches.slice(0, 5) : 'none');

  // Look for any cdn.pixabay.com links
  const cdnMatches = html.match(/https:\/\/cdn\.pixabay\.com[^\s\"\'\<\>]+/g);
  console.log('CDN links:', cdnMatches ? cdnMatches.slice(0, 5) : 'none');

  await browser.close();
})();
