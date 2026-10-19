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

  function fly(cart) {
    return new Promise((resolve) => {
      const from = cart.getBoundingClientRect();
      const slot = consoleEl.querySelector('.console__slot').getBoundingClientRect();
      const clone = cart.cloneNode(true);
      clone.classList.add('cart-flight');
      clone.removeAttribute('href');
      clone.style.left = `${from.left}px`;
      clone.style.top = `${from.top}px`;
      clone.style.width = `${from.width}px`;
      clone.style.height = `${from.height}px`;
      document.body.append(clone);
      cart.classList.add('is-flying');
      const scale = Math.min(1, slot.width / from.width * 0.8);
      const dx = slot.left + slot.width / 2 - (from.left + from.width / 2);
      const dyAbove = slot.top - from.height * scale - 10 - from.top;
      requestAnimationFrame(() => {
        clone.style.transform = `translate(${dx}px, ${dyAbove}px) scale(${scale})`;
        setTimeout(() => {
          // Drop into the slot.
          clone.style.transition = 'transform 0.35s ease-in, opacity 0.35s ease-in';
          clone.style.transform = `translate(${dx}px, ${dyAbove + from.height * scale * 0.75}px) scale(${scale})`;
          clone.style.opacity = '0';
          setTimeout(() => { clone.remove(); cart.classList.remove('is-flying'); resolve(); }, 360);
        }, 560);
      });
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
      if (!reduced) await fly(cart);
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
