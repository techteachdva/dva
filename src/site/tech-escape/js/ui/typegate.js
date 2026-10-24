/**
 * Prints readout text one character at a time.
 * Reduced motion shows the whole string at once.
 * Nothing here disables a button. The full string is on aria-label
 * before the visible print catches up.
 */

import { settings } from '../meta/settings.js?v=3.21';

export const PRINT_CPS = 16;

export function typeInto(el, text, { onDone, cps = PRINT_CPS } = {}) {
  const value = String(text || '');
  if (!el) {
    onDone?.();
    return () => {};
  }
  el.setAttribute('aria-label', value);
  if (settings.get('reduceMotion') || value.length < 2) {
    el.textContent = value;
    onDone?.();
    return () => {};
  }
  el.textContent = '';
  let i = 0;
  let timer = 0;
  let dead = false;
  const tick = () => {
    if (dead) return;
    i = Math.min(value.length, i + 1);
    el.textContent = value.slice(0, i);
    if (i < value.length) timer = window.setTimeout(tick, 1000 / cps);
    else onDone?.();
  };
  timer = window.setTimeout(tick, 1000 / cps);
  return () => {
    dead = true;
    window.clearTimeout(timer);
    if (i < value.length) el.textContent = value;
  };
}

/** Type every text node in a subtree, in order. */
export function printTree(root, { cps = PRINT_CPS, onDone } = {}) {
  if (!root) {
    onDone?.();
    return () => {};
  }
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent && node.textContent.trim()) nodes.push(node);
    node = walker.nextNode();
  }
  const originals = nodes.map((n) => n.textContent);
  if (!nodes.length || settings.get('reduceMotion')) {
    onDone?.();
    return () => {};
  }
  nodes.forEach((n) => { n.textContent = ''; });
  let ni = 0;
  let ci = 0;
  let dead = false;
  let timer = 0;
  const finish = () => {
    if (dead) return;
    dead = true;
    window.clearTimeout(timer);
    nodes.forEach((n, i) => { n.textContent = originals[i]; });
  };
  const tick = () => {
    if (dead) return;
    if (ni >= nodes.length) {
      dead = true;
      onDone?.();
      return;
    }
    const full = originals[ni];
    ci += 1;
    nodes[ni].textContent = full.slice(0, ci);
    if (ci >= full.length) {
      ni += 1;
      ci = 0;
    }
    if (ni < nodes.length) timer = window.setTimeout(tick, 1000 / cps);
    else {
      dead = true;
      onDone?.();
    }
  };
  timer = window.setTimeout(tick, 1000 / cps);
  return finish;
}

/** Every element prints at once. Inside a box, letters still arrive in order. */
export function printTogether(elements, opts = {}) {
  const stops = [];
  for (const el of elements) {
    if (!el) continue;
    stops.push(printTree(el, { cps: opts.cps ?? PRINT_CPS }));
  }
  return () => {
    for (const stop of stops) stop();
  };
}

/** Print each element after the one before it. Every row starts blank. */
export function printSequence(elements, opts = {}) {
  const list = [...elements].filter(Boolean);
  const jobs = list.map((el) => {
    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent && node.textContent.trim()) nodes.push(node);
      node = walker.nextNode();
    }
    return { nodes, originals: nodes.map((n) => n.textContent), at: 0, ch: 0 };
  }).filter((job) => job.nodes.length);
  if (!jobs.length || settings.get('reduceMotion')) {
    opts.onDone?.();
    return () => {};
  }
  for (const job of jobs) job.nodes.forEach((n) => { n.textContent = ''; });
  let ni = 0;
  let dead = false;
  let timer = 0;
  const cps = opts.cps || PRINT_CPS;
  const restore = () => {
    jobs.forEach((job) => {
      job.nodes.forEach((n, i) => { n.textContent = job.originals[i]; });
    });
  };
  const typeStep = () => {
    if (dead) return;
    if (ni >= jobs.length) {
      dead = true;
      opts.onDone?.();
      return;
    }
    const job = jobs[ni];
    if (job.at >= job.nodes.length) {
      ni += 1;
      timer = window.setTimeout(typeStep, 1000 / cps);
      return;
    }
    const full = job.originals[job.at];
    job.ch += 1;
    job.nodes[job.at].textContent = full.slice(0, job.ch);
    if (job.ch >= full.length) {
      job.at += 1;
      job.ch = 0;
    }
    timer = window.setTimeout(typeStep, 1000 / cps);
  };
  timer = window.setTimeout(typeStep, 1000 / cps);
  return () => {
    if (dead) return;
    dead = true;
    window.clearTimeout(timer);
    restore();
  };
}
