/**
 * CyberMorph — a morphology game for grades 6–8 by Mr. Phil.
 * Plain ES modules, no build step, three.js vendored, everything saved in this browser.
 * Design plan: research/cybermorph-design-plan.md
 */

import { boot } from './game/game.js';

boot().catch((err) => {
  console.error(err);
  const box = document.createElement('div');
  box.className = 'screen';
  box.innerHTML = '<div class="sheet glass"><h2>CyberMorph hit a snag</h2><p>Reload the page. If it keeps happening, tell Mr. Phil what you were doing.</p></div>';
  document.getElementById('screen-layer').append(box);
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache is optional */ });
}
