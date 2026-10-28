/**
 * Games page console: pick a cartridge from the rack and it flies up into the console's
 * slot, the screen reads LOADING, and the game opens in a new tab. The cartridge stays
 * in the slot ("NOW PLAYING") until EJECT.
 *
 * Ctrl/Cmd/Shift/middle clicks keep the browser's normal behaviour, and reduced-motion
 * users skip the flight. If a popup blocker refuses the new tab, the game opens here instead.
 */
(function () {
  const consoleEl = document.getElementById('console');
  const text = document.getElementById('console-text');
  const inserted = document.getElementById('console-inserted');
  const eject = document.getElementById('console-eject');
  if (!consoleEl) return;

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let busy = false;

  const setScreen = (msg) => { text.textContent = msg; };

  function showInserted(cart) {
    inserted.innerHTML = '';
    const label = cart.querySelector('.cart__label');
    if (label) {
      const wrap = document.createElement('div');
      wrap.className = cart.className.replace('is-flying', '');
      wrap.style.cssText = 'position:absolute;inset:0;width:auto;height:auto;';
      const shell = document.createElement('span');
      shell.className = 'cart__shell';
      shell.style.transform = 'none';
      shell.append(label.cloneNode(true));
      wrap.append(shell);
      inserted.append(wrap);
    }
  }

  function open(href) {
    // No 'noopener' feature here: with it, window.open always returns null and we could not
    // tell a blocked popup from a successful one. Cut the opener link by hand instead.
    const w = window.open(href, '_blank');
    if (w) w.opener = null;
    else window.location.href = href;
  }

  // Wait until the page stops scrolling (the console glides into view
  // first), so the flight is measured against where things really are.
  function settle() {
    return new Promise((resolve) => {
      let last = consoleEl.getBoundingClientRect().top;
      let still = 0;
      const start = performance.now();
      const tick = () => {
        const now = consoleEl.getBoundingClientRect().top;
        still = Math.abs(now - last) < 0.5 ? still + 1 : 0;
        last = now;
        if (still >= 3 || performance.now() - start > 900) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // One continuous flight: the cartridge lifts off the shelf with a little
  // tilt, arcs up over the console, hovers, then drops into the slot with a
  // small squash and the slot flashes.
  function fly(cart) {
    const from = cart.getBoundingClientRect();
    const slot = consoleEl.querySelector('.console__slot').getBoundingClientRect();
    const clone = cart.cloneNode(true);
    clone.classList.add('cart-flight');
    clone.removeAttribute('href');
    Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.append(clone);
    cart.classList.add('is-flying');
    const s = Math.min(0.72, (slot.width / from.width) * 0.8);
    const dx = slot.left + slot.width / 2 - (from.left + from.width / 2);
    // Hover just above the slot, but never off the top of the screen.
    const hoverCenter = Math.max(slot.top - (from.height * s) / 2 - 14, (from.height * s) / 2 + 8);
    const hoverY = hoverCenter - (from.top + from.height / 2);
    const inY = hoverY + from.height * s * 0.8;
    const arc = Math.min(-60, hoverY * 0.35) - 40;
    const flight = clone.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', offset: 0 },
      { transform: 'translate(0, -18px) scale(1.06) rotate(-4deg)', offset: 0.12 },
      { transform: `translate(${dx * 0.55}px, ${hoverY * 0.55 + arc}px) scale(${(1 + s) / 2}) rotate(6deg)`, offset: 0.55 },
      { transform: `translate(${dx}px, ${hoverY}px) scale(${s}) rotate(0deg)`, offset: 0.86 },
      { transform: `translate(${dx}px, ${hoverY - 6}px) scale(${s}) rotate(0deg)`, offset: 1 },
    ], { duration: 820, easing: 'cubic-bezier(0.33, 0, 0.2, 1)', fill: 'forwards' });
    return flight.finished.then(() => {
      const drop = clone.animate([
        { transform: `translate(${dx}px, ${hoverY - 6}px) scale(${s}, ${s})`, opacity: 1 },
        { transform: `translate(${dx}px, ${inY - from.height * s * 0.2}px) scale(${s * 1.04}, ${s * 0.94})`, opacity: 1, offset: 0.7 },
        { transform: `translate(${dx}px, ${inY}px) scale(${s * 0.98}, ${s})`, opacity: 0 },
      ], { duration: 380, easing: 'cubic-bezier(0.55, 0, 0.85, 0.35)', fill: 'forwards' });
      return drop.finished;
    }).then(() => {
      clone.remove();
      cart.classList.remove('is-flying');
      const mouth = consoleEl.querySelector('.console__slot-mouth');
      if (mouth && mouth.animate) {
        mouth.animate([{ boxShadow: '0 0 0 rgba(0,229,255,0)' }, { boxShadow: '0 0 26px rgba(0,229,255,0.95)' }, { boxShadow: '0 0 0 rgba(0,229,255,0)' }], { duration: 500, easing: 'ease-out' });
      }
    });
  }

  document.querySelectorAll('.rack .cart').forEach((cart) => {
    cart.addEventListener('click', async (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (busy) return;
      busy = true;
      const href = cart.getAttribute('href');
      const title = cart.dataset.title || 'GAME';
      consoleEl.classList.remove('is-loaded');
      consoleEl.classList.add('is-loading');
      setScreen(`LOADING ${title.toUpperCase()}…`);
      consoleEl.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      if (!reduced) {
        await settle();
        await fly(cart);
      }
      showInserted(cart);
      consoleEl.classList.remove('is-loading');
      consoleEl.classList.add('is-loaded');
      setScreen(`NOW PLAYING: ${title.toUpperCase()}`);
      open(href);
      busy = false;
    });
  });

  eject.addEventListener('click', () => {
    consoleEl.classList.remove('is-loaded', 'is-loading');
    setTimeout(() => { inserted.innerHTML = ''; }, 350);
    setScreen('SELECT A CARTRIDGE');
  });
})();
