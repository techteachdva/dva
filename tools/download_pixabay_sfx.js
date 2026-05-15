const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

puppeteer.use(StealthPlugin());

const OUT_DIR = process.argv[2] || 'C:/Users/phili/OneDrive/Desktop/Physix/assets/sounds/sfx';

const SOUNDS = [
  { key: 'jump',       query: '8-bit jump retro game' },
  { key: 'land',       query: 'land thud drop 8-bit retro game' },
  { key: 'coin',       query: '8-bit coin collect retro' },
  { key: 'boost',      query: '8-bit powerup level up retro game' },
  { key: 'bump',       query: 'bump hit thud 8-bit retro game' },
  { key: 'brake',      query: 'skid brake stop 8-bit retro' },
  { key: 'checkpoint', query: 'checkpoint confirm 8-bit retro' },
  { key: 'complete',   query: 'game level complete victory 8-bit' },
  { key: 'unlock',     query: 'magical chime unlock success 8-bit' },
  { key: 'death',      query: '8-bit game over death retro arcade' },
  { key: 'wind',       query: 'wind ambience soft loop nature' },
];

const CREDITS = [];

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const file = fs.createWriteStream(destPath);
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function findFirstResult(page, query) {
  const searchUrl = `https://pixabay.com/sound-effects/search/${encodeURIComponent(query.replace(/\s+/g, '-'))}/`;
  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise(r => setTimeout(r, 5000));

    const title = await page.title();
    if (title.includes('Just a moment')) {
      console.log('  Cloudflare blocked on search');
      return null;
    }

    const firstLink = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/sound-effects/"]');
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('/sound-effects/') && href.split('/').length > 2) {
          return 'https://pixabay.com' + href;
        }
      }
      return null;
    });
    return firstLink;
  } catch (e) {
    console.error(`  Error searching ${query}: ${e.message}`);
    return null;
  }
}

async function scrapeAudioUrl(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise(r => setTimeout(r, 8000));

    const title = await page.title();
    if (title.includes('Just a moment')) {
      console.log('  Cloudflare blocked');
      return null;
    }

    // Scan HTML for mp3 URLs (Pixabay embeds them in the raw HTML)
    const html = await page.content();
    const mp3Matches = html.match(/https?:\/\/[^\s\"\'\<\>]+\.mp3[^\s\"\'\<\>]*/g);
    if (mp3Matches && mp3Matches.length > 0) {
      return mp3Matches[0];
    }

    // Fallback: look for audio element
    const src = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      if (audio && audio.src) return audio.src;
      const sources = document.querySelectorAll('audio source');
      for (const s of sources) if (s.src) return s.src;
      return null;
    });
    if (src && src.startsWith('http')) return src;

    return null;
  } catch (e) {
    console.error(`  Error scraping ${url}: ${e.message}`);
    return null;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  for (const snd of SOUNDS) {
    const existingMp3 = path.join(OUT_DIR, snd.key + '.mp3');
    const existingWav = path.join(OUT_DIR, snd.key + '.wav');
    if (fs.existsSync(existingMp3) || fs.existsSync(existingWav)) {
      console.log(`[${snd.key}] already exists, skipping`);
      continue;
    }

    process.stdout.write(`[${snd.key}] searching "${snd.query}" ... `);
    const resultUrl = await findFirstResult(page, snd.query);
    if (!resultUrl) {
      console.log('SEARCH FAILED');
      continue;
    }
    process.stdout.write(`found page ... `);

    const audioUrl = await scrapeAudioUrl(page, resultUrl);
    if (!audioUrl) {
      console.log('NO AUDIO URL');
      continue;
    }

    const ext = path.extname(new URL(audioUrl).pathname) || '.mp3';
    const dest = path.join(OUT_DIR, snd.key + ext);
    try {
      await downloadFile(audioUrl, dest);
      const size = (fs.statSync(dest).size / 1024).toFixed(1);
      console.log(`OK -> ${snd.key}${ext} (${size}K)`);
      CREDITS.push(`${snd.key}: ${resultUrl}`);
    } catch (e) {
      console.log(`DOWNLOAD ERROR: ${e.message}`);
    }
  }

  await browser.close();

  const creditsPath = path.join(OUT_DIR, 'sfx_credits.txt');
  const creditsText = [
    'Sound Effects downloaded from Pixabay',
    'All sounds are royalty-free under the Pixabay Content License',
    '',
    ...CREDITS.map(c => `- ${c}`),
    '',
    'Search for more: https://pixabay.com/sound-effects/',
  ].join('\n');
  fs.writeFileSync(creditsPath, creditsText);
  console.log(`\nCredits written to ${creditsPath}`);
}

main().catch(console.error);
