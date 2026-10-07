const DIALOG_SELECTOR = '[role="dialog"]';
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const returnFocus = new WeakMap();
let initialized = false;
let headingId = 0;

function isOpen(dialog) {
  return dialog.isConnected && !dialog.classList.contains('hidden')
    && dialog.getAttribute('aria-hidden') !== 'true' && isVisible(dialog);
}

function isVisible(element) {
  for (let current = element; current; current = current.parentElement) {
    const style = window.getComputedStyle(current);
    if (current.hidden || current.hasAttribute('inert')
      || style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

function openDialogs() {
  // Somnia's dialogs are fixed-position siblings; z-index defines their visual order.
  return [...document.querySelectorAll(DIALOG_SELECTOR)].filter(isOpen)
    .filter((dialog) => dialog.getAttribute('aria-modal') !== 'false')
    .sort((a, b) => (Number.parseInt(window.getComputedStyle(a).zIndex, 10) || 0)
      - (Number.parseInt(window.getComputedStyle(b).zIndex, 10) || 0));
}

function topDialog() {
  return openDialogs().at(-1);
}

function focusableElements(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => {
    return el.tabIndex >= 0 && !el.matches(':disabled') && isVisible(el);
  });
}

function labelDialog(dialog) {
  if (dialog.hasAttribute('aria-label')) return;
  const labelledBy = dialog.getAttribute('aria-labelledby');
  if (labelledBy && labelledBy.trim().split(/\s+/).every((id) => document.getElementById(id))) return;
  dialog.removeAttribute('aria-labelledby');
  const heading = dialog.querySelector('h1, h2, h3');
  if (!heading) return;
  if (!heading.id) {
    headingId += 1;
    heading.id = `somnia-dialog-title-${headingId}`;
  }
  dialog.setAttribute('aria-labelledby', heading.id);
}

function activate(dialog) {
  labelDialog(dialog);
  if (dialog.getAttribute('aria-modal') === 'false') return;
  if (!returnFocus.has(dialog)) returnFocus.set(dialog, document.activeElement);
  requestAnimationFrame(() => {
    if (topDialog() !== dialog || dialog.contains(document.activeElement)) return;
    focusDialog(dialog);
  });
}

function focusDialog(dialog) {
  const items = focusableElements(dialog);
  const preferred = ['#btn-enter-game', '#pause-resume', '.modal-close', '#tutorial-next']
    .map((selector) => items.find((item) => item.matches(selector))).find(Boolean);
  if (!items.length) dialog.setAttribute('tabindex', '-1');
  (preferred || items[0] || dialog).focus({ preventScroll: true });
}

function deactivate(dialog) {
  const previous = returnFocus.get(dialog);
  returnFocus.delete(dialog);
  requestAnimationFrame(() => {
    const active = topDialog();
    if (active?.contains(document.activeElement)) return;
    if (previous instanceof HTMLElement && previous.isConnected && isVisible(previous)
      && !previous.matches(':disabled') && (!active || active.contains(previous))) {
      previous.focus({ preventScroll: true });
    } else if (active) {
      focusDialog(active);
    }
  });
}

function closeDialog(dialog) {
  const control = dialog.querySelector(
    '#btn-enter-game, #pause-resume, .modal-close, #tutorial-skip',
  );
  control?.click();
}

function trapTab(event, dialog) {
  const items = focusableElements(dialog);
  if (!items.length) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (!dialog.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (!items.includes(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onKeyDown(event) {
  const dialog = topDialog();
  if (!dialog) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeDialog(dialog);
    return;
  }

  if (event.key === 'Tab') trapTab(event, dialog);
}

export function initDialogAccessibility() {
  if (initialized) return;
  initialized = true;

  const dialogs = [...document.querySelectorAll(DIALOG_SELECTOR)];
  dialogs.filter(isOpen).forEach(activate);

  const observer = new MutationObserver((records) => {
    new Set(records.map(({ target }) => target)).forEach((target) => {
      if (!(target instanceof HTMLElement) || !target.matches(DIALOG_SELECTOR)) return;
      if (isOpen(target)) activate(target);
      else deactivate(target);
    });
  });

  dialogs.forEach((dialog) => {
    observer.observe(dialog, { attributes: true, attributeFilter: ['class', 'aria-hidden', 'aria-modal'] });
  });
  document.addEventListener('keydown', onKeyDown, { capture: true });
}
