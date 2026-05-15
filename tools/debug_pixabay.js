const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Use domcontentloaded instead of networkidle
  await page.goto('https://pixabay.com/sound-effects/retro-jump-1-236687/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(5000);

  const title = await page.title();
  console.log('Title:', title);

  // Check if there's a cookie consent or login wall
  const body = await page.content();
  console.log('Body length:', body.length);
  console.log('Contains "audio":', body.includes('audio'));
  console.log('Contains "mp3":', body.includes('.mp3'));
  console.log('Contains "download":', body.includes('download'));

  // Try to find any media URLs in the page
  const matches = body.match(/cdn\.pixabay\.com[^\s\"\'\>]+/g);
  console.log('CDN matches:', matches ? matches.slice(0, 5) : 'none');

  // Look for the specific pattern Pixabay uses for audio
  const audioMatches = body.match(/pixabay\.com[^\s\"\'\>]*\.mp3/g);
  console.log('Audio matches:', audioMatches ? audioMatches.slice(0, 5) : 'none');

  await browser.close();
})();
