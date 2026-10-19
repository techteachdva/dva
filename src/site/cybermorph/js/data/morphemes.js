/**
 * Every morpheme CyberMorph can put on a ring.
 *
 * Fields:
 *  - id       unique key used by every district file (two morphemes can share a spelling: `in` and `in2`)
 *  - text     how it is spelled when it joins a word
 *  - type     pfx | base | sfx | link | word   (word = a whole free word inside a Lingo phrase)
 *  - origin   anglo | latin | greek | lingo     (sets the morpheme's look: amber glass, grey marble, holo blue, lined paper)
 *  - meaning  one short, plain gloss
 *  - say      what the speech voice should read when the spelling alone reads badly
 *  - cvc      true when a vowel suffix doubles the final consonant (run + ing -> running)
 *  - assim    prefix assimilation: next letter -> new spelling (in + mobile -> immobile)
 *  - es       Spanish cognate, shown only when the Cognates setting is on
 *  - cat      key in the forked catalog (js/data/catalog.js) for the longer lesson notes
 */

const M = (id, text, type, origin, meaning, extra = {}) => ({ id, text, type, origin, meaning, ...extra });

const LIST = [
  // ── Anglo-Saxon ───────────────────────────────────────────────
  M('un', 'un', 'pfx', 'anglo', 'not; the opposite of', { cat: 'pfx:un-' }),
  M('mis', 'mis', 'pfx', 'anglo', 'wrongly; badly', { cat: 'pfx:mis-' }),
  M('over', 'over', 'pfx', 'anglo', 'too much; above', { cat: 'pfx:over-' }),
  M('fore', 'fore', 'pfx', 'anglo', 'before; in front', { cat: 'pfx:fore-' }),
  M('out', 'out', 'pfx', 'anglo', 'more than; beyond'),
  M('under', 'under', 'pfx', 'anglo', 'below; beneath'),

  M('help', 'help', 'base', 'anglo', 'to give aid'),
  M('play', 'play', 'base', 'anglo', 'to have fun; to perform'),
  M('kind', 'kind', 'base', 'anglo', 'gentle and caring'),
  M('friend', 'friend', 'base', 'anglo', 'someone you like and trust'),
  M('care', 'care', 'base', 'anglo', 'to look after; to worry'),
  M('hope', 'hope', 'base', 'anglo', 'to wish for something'),
  M('fear', 'fear', 'base', 'anglo', 'the feeling of danger'),
  M('run', 'run', 'base', 'anglo', 'to move fast on foot', { cvc: true }),
  M('stop', 'stop', 'base', 'anglo', 'to halt', { cvc: true }),
  M('big', 'big', 'base', 'anglo', 'large', { cvc: true }),
  M('dark', 'dark', 'base', 'anglo', 'without light'),
  M('sleep', 'sleep', 'base', 'anglo', 'to rest with eyes closed'),
  M('read', 'read', 'base', 'anglo', 'to understand writing', { say: 'reed' }),
  M('see', 'see', 'base', 'anglo', 'to look; to notice'),
  M('stand', 'stand', 'base', 'anglo', 'to be upright'),
  M('whelm', 'whelm', 'base', 'anglo', 'to cover over; to bury'),
  M('key', 'key', 'base', 'anglo', 'a tool that opens; a button'),
  M('board', 'board', 'base', 'anglo', 'a flat piece'),
  M('fire', 'fire', 'base', 'anglo', 'burning flame'),
  M('wall', 'wall', 'base', 'anglo', 'a barrier'),
  M('down', 'down', 'base', 'anglo', 'to a lower place'),
  M('load', 'load', 'base', 'anglo', 'something carried'),
  M('net', 'net', 'base', 'anglo', 'a mesh that connects'),
  M('work', 'work', 'base', 'anglo', 'effort; a job'),
  M('lap', 'lap', 'base', 'anglo', 'the top of your legs when you sit'),
  M('top', 'top', 'base', 'anglo', 'the highest part'),

  M('s', 's', 'sfx', 'anglo', 'more than one', { say: 'ess', cat: 'sfx:-s' }),
  M('es', 'es', 'sfx', 'anglo', 'more than one (after s, x, ch, sh)', { say: 'ez', cat: 'sfx:-s' }),
  M('ed', 'ed', 'sfx', 'anglo', 'in the past', { say: 'ed', cat: 'sfx:-ed' }),
  M('ing', 'ing', 'sfx', 'anglo', 'happening now; the act of', { cat: 'sfx:-ing' }),
  M('er', 'er', 'sfx', 'anglo', 'one who; more', { say: 'er', cat: 'sfx:-er' }),
  M('est', 'est', 'sfx', 'anglo', 'the most'),
  M('ful', 'ful', 'sfx', 'anglo', 'full of', { say: 'full', cat: 'sfx:-ful' }),
  M('less', 'less', 'sfx', 'anglo', 'without', { cat: 'sfx:-less' }),
  M('ness', 'ness', 'sfx', 'anglo', 'the state of being', { cat: 'sfx:-ness' }),
  M('ly', 'ly', 'sfx', 'anglo', 'in a way; like', { say: 'lee', cat: 'sfx:-ly' }),
  M('y', 'y', 'sfx', 'anglo', 'full of; like', { say: 'ee', cat: 'sfx:-y' }),
  M('en', 'en', 'sfx', 'anglo', 'to make; to become'),
  M('ship', 'ship', 'sfx', 'anglo', 'the state of; a bond'),

  // ── Latin ─────────────────────────────────────────────────────
  M('re', 're', 'pfx', 'latin', 'again; back', { say: 'ree', cat: 'pfx:re-' }),
  M('in', 'in', 'pfx', 'latin', 'not', { cat: 'pfx:in-', assim: { m: 'im', b: 'im', p: 'im', l: 'il', r: 'ir' } }),
  M('in2', 'in', 'pfx', 'latin', 'in; into', { cat: 'pfx:in-toward', assim: { m: 'im', b: 'im', p: 'im' } }),
  M('inter', 'inter', 'pfx', 'latin', 'between', { cat: 'pfx:inter-' }),
  M('sub', 'sub', 'pfx', 'latin', 'under; below', { cat: 'pfx:sub-', assim: { p: 'sup', f: 'suf', c: 'suc', g: 'sug' } }),
  M('trans', 'trans', 'pfx', 'latin', 'across', { cat: 'pfx:trans-' }),
  M('de', 'de', 'pfx', 'latin', 'down; undo; away', { say: 'dee', cat: 'pfx:de-' }),
  M('ex', 'ex', 'pfx', 'latin', 'out', { cat: 'pfx:ex-', assim: { f: 'ef' } }),
  M('e', 'e', 'pfx', 'latin', 'out (a short form of ex)', { say: 'ee' }),
  M('con', 'con', 'pfx', 'latin', 'with; together', { cat: 'pfx:con-', assim: { l: 'col', r: 'cor', b: 'com', m: 'com', p: 'com' } }),
  M('pre', 'pre', 'pfx', 'latin', 'before', { say: 'pree', cat: 'pfx:pre-' }),
  M('dis', 'dis', 'pfx', 'latin', 'apart; not', { cat: 'pfx:dis-' }),
  M('ad', 'ad', 'pfx', 'latin', 'to; toward', { cat: 'pfx:ad-', assim: { t: 'at', c: 'ac', f: 'af', s: 'as', p: 'ap', l: 'al', g: 'ag', n: 'an' } }),
  M('contra', 'contra', 'pfx', 'latin', 'against', { cat: 'pfx:contra-' }),

  M('port', 'port', 'base', 'latin', 'to carry', { es: 'portar (to carry)', cat: 'root:port' }),
  M('rupt', 'rupt', 'base', 'latin', 'to break; to burst', { es: 'romper (to break)', cat: 'root:rupt' }),
  M('struct', 'struct', 'base', 'latin', 'to build', { es: 'construir (to build)', cat: 'root:struct' }),
  M('dict', 'dict', 'base', 'latin', 'to say; to tell', { es: 'decir (to say)', cat: 'root:dict' }),
  M('spect', 'spect', 'base', 'latin', 'to look; to watch', { es: 'espectador (spectator)', cat: 'root:spect' }),
  M('tract', 'tract', 'base', 'latin', 'to pull; to drag', { es: 'traer (to bring)', cat: 'root:tract' }),
  M('ject', 'ject', 'base', 'latin', 'to throw', { es: 'proyectar (to project)', cat: 'root:ject' }),
  M('form', 'form', 'base', 'latin', 'shape', { es: 'forma (shape)', cat: 'root:form' }),
  M('vis', 'vis', 'base', 'latin', 'to see', { es: 'visión (vision)', cat: 'root:vis' }),
  M('act', 'act', 'base', 'latin', 'to do', { es: 'actuar (to act)', cat: 'root:act' }),
  M('mobile', 'mobile', 'base', 'latin', 'able to move', { es: 'móvil (mobile)' }),
  M('script', 'script', 'base', 'latin', 'to write', { es: 'escribir (to write)', cat: 'root:scrib' }),
  M('mit', 'mit', 'base', 'latin', 'to send', { cvc: true, es: 'emitir (to send out)', cat: 'root:mit' }),
  M('bene', 'bene', 'pfx', 'latin', 'good; well', { say: 'beh-nay', es: 'bien (well)' }),
  M('fic', 'fic', 'base', 'latin', 'to make; to do', { say: 'fish', es: 'fábrica (factory)' }),

  M('ion', 'ion', 'sfx', 'latin', 'the act or result of', { say: 'shun', cat: 'sfx:-tion' }),
  M('ation', 'ation', 'sfx', 'latin', 'the act or result of', { say: 'ay-shun', cat: 'sfx:-tion' }),
  M('able', 'able', 'sfx', 'latin', 'can be done', { say: 'uh-bull', cat: 'sfx:-able' }),
  M('ible', 'ible', 'sfx', 'latin', 'can be done', { say: 'ih-bull', cat: 'sfx:-able' }),
  M('ive', 'ive', 'sfx', 'latin', 'tending to; doing', { say: 'iv', cat: 'sfx:-ive' }),
  M('or', 'or', 'sfx', 'latin', 'one who; a thing that', { say: 'or', cat: 'sfx:-er' }),
  M('ure', 'ure', 'sfx', 'latin', 'the act or result of', { say: 'yur' }),
  M('ant', 'ant', 'sfx', 'latin', 'being; one who', { cat: 'sfx:-ant' }),
  M('ial', 'ial', 'sfx', 'latin', 'relating to', { say: 'ee-ul' }),

  // ── Greek ─────────────────────────────────────────────────────
  M('bio', 'bio', 'base', 'greek', 'life', { cat: 'root:bio' }),
  M('geo', 'geo', 'base', 'greek', 'earth', { say: 'jee-oh', cat: 'root:geo' }),
  M('photo', 'photo', 'base', 'greek', 'light'),
  M('tele', 'tele', 'base', 'greek', 'far', { say: 'tell-uh', cat: 'root:tele' }),
  M('micro', 'micro', 'base', 'greek', 'small'),
  M('auto', 'auto', 'base', 'greek', 'self'),
  M('hydro', 'hydro', 'base', 'greek', 'water'),
  M('therm', 'therm', 'base', 'greek', 'heat'),
  M('chron', 'chron', 'base', 'greek', 'time', { say: 'kron' }),
  M('psych', 'psych', 'base', 'greek', 'mind', { say: 'sike', cat: 'root:psych' }),
  M('techn', 'techn', 'base', 'greek', 'skill; craft', { say: 'tech-n', cat: 'root:techn' }),
  M('demo', 'demo', 'base', 'greek', 'people', { say: 'deh-mo' }),
  M('syn', 'syn', 'pfx', 'greek', 'together', { say: 'sin' }),
  M('the', 'the', 'base', 'greek', 'to put; to place', { say: 'thuh' }),
  M('tris', 'tris', 'base', 'greek', 'three'),
  M('kai', 'kai', 'base', 'greek', 'and', { say: 'kye' }),
  M('deka', 'deka', 'base', 'greek', 'ten', { say: 'deh-kuh' }),
  M('graph', 'graph', 'base', 'greek', 'to write; to draw', { cat: 'root:graph' }),
  M('log', 'log', 'base', 'greek', 'word; study', { cat: 'sfx:-logy' }),
  M('meter', 'meter', 'base', 'greek', 'to measure'),
  M('scope', 'scope', 'base', 'greek', 'to look at'),
  M('phone', 'phone', 'base', 'greek', 'sound; voice'),
  M('phob', 'phob', 'base', 'greek', 'fear', { say: 'foab' }),
  M('cracy', 'cracy', 'base', 'greek', 'rule; government', { say: 'kruh-see' }),
  M('o', 'o', 'link', 'greek', 'links two Greek pieces', { say: 'oh' }),
  M('gy', 'y', 'sfx', 'greek', 'the act or study of', { say: 'ee' }),
  M('ic', 'ic', 'sfx', 'greek', 'relating to', { say: 'ick', cat: 'sfx:-ic' }),
  M('al', 'al', 'sfx', 'greek', 'relating to', { say: 'ul', cat: 'sfx:-al' }),
  M('ist', 'ist', 'sfx', 'greek', 'one who'),
  M('ia', 'ia', 'sfx', 'greek', 'a condition', { say: 'ee-uh' }),
  M('sis', 'sis', 'sfx', 'greek', 'a process', { say: 'sis' }),

  // ── Lingo (pieces of everyday speech) ─────────────────────────
  M('fix', 'fix', 'word', 'lingo', 'to get ready; to repair'),
  M('to', 'to', 'word', 'lingo', 'toward; in order to'),
  M('go', 'go', 'word', 'lingo', 'to move; to leave'),
  M('want', 'want', 'word', 'lingo', 'to wish for'),
  M('got', 'got', 'word', 'lingo', 'have; must'),
  M('all', 'all', 'word', 'lingo', 'every one; completely'),
  M('right', 'right', 'word', 'lingo', 'correct; okay'),
  M('what', 'what', 'word', 'lingo', 'which thing'),
  M('is', 'is', 'word', 'lingo', 'exists; equals'),
  M('up', 'up', 'word', 'lingo', 'higher; happening'),
  M('you', 'you', 'word', 'lingo', 'the person spoken to'),
  M('let', 'let', 'word', 'lingo', 'to allow'),
  M('us', 'us', 'word', 'lingo', 'me and others'),
  M('am', 'am', 'word', 'lingo', 'exists (I am)'),
  M('not', 'not', 'word', 'lingo', 'no; the opposite'),
  M('suspicious', 'suspicious', 'word', 'lingo', 'making you think something is wrong'),
  M('charisma', 'charisma', 'word', 'lingo', 'charm that draws people in', { say: 'kuh-riz-muh' }),
  M('brother', 'brother', 'word', 'lingo', 'a male sibling; a close friend'),
  M('family', 'family', 'word', 'lingo', 'the people you belong with'),
  M('vibration', 'vibration', 'word', 'lingo', 'a shaking; a feeling in the air'),
  M('situation', 'situation', 'word', 'lingo', 'how things are set up'),
  M('relationship', 'relationship', 'word', 'lingo', 'a connection between people'),
  M('enemy', 'enemy', 'word', 'lingo', 'someone against you'),
  M('breakfast', 'breakfast', 'word', 'lingo', 'the morning meal'),
  M('lunch', 'lunch', 'word', 'lingo', 'the midday meal'),
  M('crash', 'crash', 'base', 'lingo', 'to smash; to fall apart'),
  M('glow', 'glow', 'base', 'lingo', 'to shine'),
  M('low', 'low', 'base', 'lingo', 'not high; quiet'),
  M('lkey', 'key', 'base', 'lingo', 'a tone or level (as in music)'),
  M('lout', 'out', 'base', 'lingo', 'outside; out of control'),
  M('lup', 'up', 'base', 'lingo', 'higher; better'),
  M('cook', 'cook', 'base', 'lingo', 'to heat food'),
  M('ghost', 'ghost', 'base', 'lingo', 'a spirit that disappears'),
  M('bother', 'bother', 'base', 'lingo', 'to annoy; to worry'),
  M('watch', 'watch', 'base', 'lingo', 'to look at for a while'),
  M('goat', 'goat', 'base', 'lingo', 'G.O.A.T. = Greatest Of All Time', { say: 'goat' }),
  M('sushi', 'sushi', 'word', 'lingo', 'a Japanese rice dish'),
  M('success', 'success', 'word', 'lingo', 'reaching a goal'),
  M('charity', 'charity', 'word', 'lingo', 'giving to help others'),
  M('brownie', 'brownie', 'word', 'lingo', 'a chocolate square'),
  M('famous', 'famous', 'word', 'lingo', 'known by many people'),
  M('vibrant', 'vibrant', 'word', 'lingo', 'bright and full of life'),
  M('station', 'station', 'word', 'lingo', 'a stopping place'),
  M('energy', 'energy', 'word', 'lingo', 'power to do work'),
  M('brain', 'brain', 'word', 'lingo', 'the organ you think with'),
  M('fish', 'fish', 'word', 'lingo', 'a swimming animal'),
  M('gone', 'gone', 'word', 'lingo', 'left; away'),
  M('wand', 'wand', 'word', 'lingo', 'a thin magic stick'),
  M('gut', 'gut', 'word', 'lingo', 'the belly'),
  M('ate', 'ate', 'word', 'lingo', 'had a meal'),
  M('ride', 'ride', 'word', 'lingo', 'to travel on'),
  M('who', 'who', 'word', 'lingo', 'which person'),
  M('was', 'was', 'word', 'lingo', 'existed (past)'),
  M('yell', 'yell', 'word', 'lingo', 'to shout'),
  M('lot', 'lot', 'word', 'lingo', 'a large amount'),
  M('lust', 'lust', 'word', 'lingo', 'a strong want'),
  M('lunar', 'lunar', 'word', 'lingo', 'about the moon'),
  M('brunette', 'brunette', 'word', 'lingo', 'a person with brown hair'),
  M('break', 'break', 'word', 'lingo', 'to split apart'),
  M('fast', 'fast', 'word', 'lingo', 'quick; or a time of not eating'),
];

export const MORPHEMES = Object.freeze(Object.fromEntries(LIST.map((m) => [m.id, Object.freeze(m)])));

export function morph(id) {
  const m = MORPHEMES[id];
  if (!m) throw new Error(`CyberMorph: unknown morpheme "${id}"`);
  return m;
}

export function hasMorph(id) {
  return Object.prototype.hasOwnProperty.call(MORPHEMES, id);
}

export const TYPE_LABEL = { pfx: 'prefix', base: 'base', sfx: 'suffix', link: 'linking vowel', word: 'word' };
export const ORIGIN_LABEL = { anglo: 'Anglo-Saxon', latin: 'Latin', greek: 'Greek', lingo: 'Lingo' };
