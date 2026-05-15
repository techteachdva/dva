const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

puppeteer.use(StealthPlugin());

const OUT_DIR = process.argv[2] || 'C:/Users/phili/OneDrive/Desktop/Physix/assets/sounds/sfx';

// Specific Pixabay URLs to try for each sound
const SOUNDS = [
  {
    key: 'boost',
    urls: [
      'https://pixabay.com/sound-effects/film-special-effects-level-up-enhancement-8-bit-retro-sound-effect-153002/',
      'https://pixabay.com/sound-effects/8-bit-powerup-1-164738/',
      'https://pixabay.com/sound-effects/power-up-sparkle-1-177774/',
    ]
  },
  {
    key: 'death',
    urls: [
      'https://pixabay.com/sound-effects/8-bit-game-over-170747/',
      'https://pixabay.com/sound-effects/retro-arcade-death-1-272923/',
      'https://pixabay.com/sound-effects/game-over-8-bit-164700/',
    ]
  },
  {
    key: 'unlock',
    urls: [
      'https://pixabay.com/sound-effects/magical-chime-1-166047/',
      'https://pixabay.com/sound-effects/retro-success-1-274390/',
      'https://pixabay.com/sound-effects/success-bell-1-164701/',
    ]
  },
  {
    key: 'bump',
    urls: [
      'https://pixabay.com/sound-effects/8-bit-bump-1-164738/',
      'https://pixabay.com/sound-effects/retro-hit-1-272924/',
      'https://pixabay.com/sound-effects/bump-thud-1-164702/',
    ]
  },
  {
    key: 'brake',
    urls: [
      'https://pixabay.com/sound-effects/retro-brake-1-272925/',
      'https://pixabay.com/sound-effects/8-bit-skid-1-274391/',
      'https://pixabay.com/sound-effects/skid-stop-1-164703/',
    ]
  },
  {
    key: 'land',
    urls: [
      'https://pixabay.com/sound-effects/retro-thud-1-272927/',
      'https://pixabay.com/sound-effects/8-bit-land-1-274392/',
      'https://pixabay.com/sound-effects/land-thud-1-164704/',
    ]
  },
  {
    key: 'wind',
    urls: [
      'https://pixabay.com/sound-effects/soft-wind-1-166048/',
      'https://pixabay.com/sound-effects/wind-ambience-1-274393/',
      'https://pixabay.com/sound-effects/wind-loop-1-164705/',
    ]
  },
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

async function scrapeAudioUrl(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise(r => setTimeout(r, 8000));

    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('404')) {
      return null;
    }

    const html = await page.content();
    const mp3Matches = html.match(/https?:\/\/[^\s\"\'\<\>]+\.mp3[^\s\"\'\<\>]*/g);
    if (mp3Matches && mp3Matches.length > 0) {
      return mp3Matches[0];
    }

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

    let audioUrl = null;
    let usedUrl = null;
    for (const url of snd.urls) {
      process.stdout.write(`[${snd.key}] trying ${url.split('/').pop()} ... `);
      audioUrl = await scrapeAudioUrl(page, url);
      if (audioUrl) {
        usedUrl = url;
        console.log('OK');
        break;
      }
      console.log('no audio');
    }

    if (!audioUrl) {
      console.log(`[${snd.key}] ALL URLS FAILED`);
      continue;
    }

    const ext = path.extname(new URL(audioUrl).pathname) || '.mp3';
    const dest = path.join(OUT_DIR, snd.key + ext);
    try {
      await downloadFile(audioUrl, dest);
      const size = (fs.statSync(dest).size / 1024).toFixed(1);
      console.log(`[${snd.key}] downloaded -> ${snd.key}${ext} (${size}K)`);
      CREDITS.push(`${snd.key}: ${usedUrl}`);
    } catch (e) {
      console.log(`[${snd.key}] DOWNLOAD ERROR: ${e.message}`);
    }
  }

  await browser.close();

  const creditsPath = path.join(OUT_DIR, 'sfx_credits.txt');
  const existingCredits = fs.existsSync(creditsPath) ? fs.readFileSync(creditsPath, 'utf8') : '';
  const newCredits = [
    'Sound Effects downloaded from Pixabay',
    'All sounds are royalty-free under the Pixabay Content License',
    '',
    ...CREDITS.map(c => `- ${c}`),
    '',
    'Search for more: https://pixabay.com/sound-effects/',
  ].join('\n');
  fs.writeFileSync(creditsPath, newCredits);
  console.log(`\nCredits written to ${creditsPath}`);
}

main().catch(console.error);
