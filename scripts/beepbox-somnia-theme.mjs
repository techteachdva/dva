#!/usr/bin/env node
import { writeFileSync } from "fs";
// ============================================================================
// Reconstruction of "Dreamer's Awakening". The menu mp3 is NOT a render of
// this file. It is the original two-minute BeepBox export, played twice,
// then the melody (0:20–1:20) once more. A fresh synth render of this
// script does not match that export.
//
// This script is a faithful port of Song.toBase64String() from BeepBox's
// synth.ts (URL format version 9), generating a complete song URL for
// https://beepbox.co — 5 pitch channels + 1 drum channel, 60 bars of
// 8 beats at 96 BPM = exactly 5:00.
//
// Usage: node scripts/beepbox-somnia-theme.mjs
// ============================================================================

const base64IntToCharCode = [48,49,50,51,52,53,54,55,56,57,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,45,95];

class BitFieldWriter {
	constructor() { this._index = 0; this._bits = []; }
	clear() { this._index = 0; }
	write(bitCount, value) {
		bitCount--;
		while (bitCount >= 0) { this._bits[this._index++] = (value >>> bitCount) & 1; bitCount--; }
	}
	writeLongTail(minValue, minBits, value) {
		if (value < minValue) throw new Error("value out of bounds");
		value -= minValue;
		let numBits = minBits;
		while (value >= (1 << numBits)) { this._bits[this._index++] = 1; value -= 1 << numBits; numBits++; }
		this._bits[this._index++] = 0;
		while (numBits > 0) { numBits--; this._bits[this._index++] = (value >>> numBits) & 1; }
	}
	writePartDuration(value) { this.writeLongTail(1, 3, value); }
	writePinCount(value) { this.writeLongTail(1, 0, value); }
	writePitchInterval(value) {
		if (value < 0) { this.write(1, 1); this.writeLongTail(1, 3, -value); }
		else { this.write(1, 0); this.writeLongTail(1, 3, value); }
	}
	concat(other) { for (let i = 0; i < other._index; i++) this._bits[this._index++] = other._bits[i]; }
	encodeBase64(buffer) {
		for (let i = 0; i < this._index; i += 6) {
			const value = ((this._bits[i] || 0) << 5) | ((this._bits[i+1] || 0) << 4) | ((this._bits[i+2] || 0) << 3) | ((this._bits[i+3] || 0) << 2) | ((this._bits[i+4] || 0) << 1) | (this._bits[i+5] || 0);
			buffer.push(base64IntToCharCode[value]);
		}
		return buffer;
	}
	lengthBase64() { return Math.ceil(this._index / 6); }
}

// --- Config constants (from SynthConfig.ts) ---
const PARTS_PER_BEAT = 24;
const MAX_CHORD_SIZE = 4;
const BITS_PER_NOTE_SIZE = 2; // getNeededBits(noteSizeMax=3)

// EffectType bits
const FX = { reverb: 0, chorus: 1, panning: 2, distortion: 3, bitcrusher: 4, noteFilter: 5, echo: 6, pitchShift: 7, detune: 8, vibrato: 9, transition: 10, chord: 11 };

// InstrumentType
const TYPE = { chip: 0, fm: 1, noise: 2, spectrum: 3, drumset: 4, harmonics: 5, pwm: 6, pickedString: 7, supersaw: 8 };

// Envelope indices (Config.envelopes)
const ENV = { none: 0, noteSize: 1, punch: 2, flare1: 3, flare2: 4, flare3: 5, twang1: 6, twang2: 7, twang3: 8, swell1: 9, swell2: 10, swell3: 11, tremolo1: 12, tremolo2: 13, tremolo3: 14, tremolo4: 15, tremolo5: 16, tremolo6: 17, decay1: 18, decay2: 19, decay3: 20 };

// Automation target indices (Config.instrumentAutomationTargets)
const TARGET = { none: 0, noteVolume: 1, pulseWidth: 2, stringSustain: 3, unison: 4, operatorFrequency: 5, operatorAmplitude: 6, feedbackAmplitude: 7, pitchShift: 8, detune: 9, vibratoDepth: 10, noteFilterAllFreqs: 11, noteFilterFreq: 12, noteFilterGain: 13, supersawDynamism: 14, supersawSpread: 15, supersawShape: 16 };
const TARGET_MAX_COUNT = [1,1,1,1,1,4,4,1,1,1,1,1,8,8,1,1,1];

// fadeOut setting index into Config.fadeOutTicks = [-24,-12,-6,-3,-1,6,12,24,48,72,96]
const FADE = { m24: 0, m12: 1, m6: 2, m3: 3, neutral: 4, t6: 5, t12: 6, t24: 7, t48: 8, t72: 9, t96: 10 };

// --- Note helpers ---
// pitches: number or array; pins: optional [[time, size], ...] for swells/fades (last time = note length)
function N(pitches, start, len, size, opts = {}) {
	const pins = opts.pins
		? opts.pins.map(([t, s]) => ({ interval: 0, time: t, size: s }))
		: [{ interval: 0, time: 0, size }, { interval: 0, time: len, size: opts.fade ? 0 : size }];
	return { pitches: Array.isArray(pitches) ? pitches : [pitches], pins, start, end: start + len, continuesLastPattern: false };
}

// ============================================================================
// COMPOSITION — "Somnia: Dreamer's Awakening" (seamless 5:00 menu loop)
// Key C, 96 BPM, 8 beats/bar, 60 bars. One bar is 5 seconds.
//   0:00 Mist       pads and bells, harp arrives late
//   0:40 Awakening  the theme, soft percussion then the groove
//   1:20 Wander     the second phrase, then the lead drops out
//   2:20 Sweep      held harp chords and rising strings
//   3:20 Climax     theme and answer, full orchestra
//   4:20 Resolve    thin again; the last bar is Gadd9 with the sparkle run
//                   and snare fill that fall into bar 1's quiet Am9
// BeepBox pitch = MIDI - 12 (middle C / C4 = 48).
// ============================================================================

const BAR = 8 * PARTS_PER_BEAT; // 192 parts per bar

// --- Music box (picked string): 8th-note harp arps, 16 notes/bar ---
function arp(pitches) {
	return pitches.map((p, i) => N(p, i * 12, 12, i % 8 === 0 ? 3 : 2));
}
function arpQuarter(pitches) {
	return pitches.map((p, i) => N(p, i * 24, 24, i === 0 ? 3 : 2));
}
const boxPatterns = [
	// P1 Am9
	arp([57,64,69,71, 76,71,69,64, 60,64,69,64, 57,64,60,64]),
	// P2 Fmaj9
	arp([53,60,65,67, 69,67,65,60, 57,60,65,60, 53,60,57,60]),
	// P3 Cmaj9
	arp([55,60,67,74, 76,74,67,60, 62,64,67,64, 55,60,62,60]),
	// P4 Gadd9
	arp([55,62,69,71, 74,71,69,62, 59,62,69,62, 55,59,62,59]),
	// P5 Em7
	arp([52,59,64,71, 76,71,64,59, 55,59,64,59, 52,55,59,55]),
	// P6 Am sparse (break — winding-down music box)
	arpQuarter([69,72,76,72, 69,64,60,64]),
	// P7 F sparse (break)
	arpQuarter([65,69,72,69, 65,60,57,60]),
	[],
];

// --- Dream pad (FM): one swelling 4-note chord per bar ---
function padChord(pitches, endSize = 1) {
	return [N(pitches, 0, BAR, 0, { pins: [[0, 1], [96, 3], [192, endSize]] })];
}
const padPatterns = [
	padChord([45, 48, 52, 59]), // P1 Am9:  A3 C4 E4 B4
	padChord([41, 45, 48, 52]), // P2 Fmaj9: F3 A3 C4 E4
	padChord([43, 48, 50, 52]), // P3 Cmaj9: G3 C4 D4 E4
	padChord([43, 47, 50, 57]), // P4 Gadd9: G3 B3 D4 A4
	padChord([43, 47, 50, 52]), // P5 Em7:  G3 B3 D4 E4
	padChord([43, 48, 50, 57]), // P6 Gsus: G3 C4 D4 A4
	[],
	[],
];

// --- Lead (FM "crystal" w/ echo): the melody ---
const leadPatterns = [
	// P1 Am:  E5 C5 D5 B4 A4
	[N(64, 0, 72, 3), N(60, 72, 24, 2), N(62, 96, 48, 3), N(59, 144, 24, 2), N(57, 168, 24, 2)],
	// P2 F:   A4 C5 A4 G4
	[N(57, 0, 48, 3), N(60, 48, 48, 2), N(57, 96, 24, 2), N(55, 120, 72, 3)],
	// P3 C:   G4 E5 D5 C5
	[N(55, 0, 48, 2), N(64, 48, 48, 3), N(62, 96, 24, 2), N(60, 120, 72, 3)],
	// P4 G:   D5 B4 A4 B4 G4
	[N(62, 0, 72, 3), N(59, 72, 24, 2), N(57, 96, 24, 2), N(59, 120, 48, 2), N(55, 168, 24, 2)],
	// P5 F var: A4 C5 F5 E5 C5
	[N(57, 0, 24, 2), N(60, 24, 24, 2), N(65, 48, 48, 3), N(64, 96, 48, 3), N(60, 144, 48, 2)],
	// P6 G var: D5 G5 A5 G5 D5
	[N(62, 0, 48, 2), N(67, 48, 48, 3), N(69, 96, 24, 3), N(67, 120, 48, 2), N(62, 168, 24, 2)],
	// P7 Em:  B4 G4 A4 B4
	[N(59, 0, 72, 3), N(55, 72, 24, 2), N(57, 96, 24, 2), N(59, 120, 72, 3)],
	// P8 Am climax: C5 E5 A5 E5
	[N(60, 0, 48, 2), N(64, 48, 48, 3), N(69, 96, 72, 3), N(64, 168, 24, 2)],
];

// --- Bass (chip triangle): root / root / fifth / root ---
function bassLine(root, fifth) {
	return [N(root, 0, 84, 3), N(root, 84, 12, 2), N(fifth, 96, 48, 2), N(root, 144, 48, 2)];
}
const bassPatterns = [
	bassLine(33, 40), // P1 Am: A2 / E3
	bassLine(29, 36), // P2 F:  F2 / C3
	bassLine(36, 43), // P3 C:  C3 / G3
	bassLine(31, 38), // P4 G:  G2 / D3
	bassLine(28, 35), // P5 Em: E2 / B2
	[], [], [],
];

// --- Sparkle (FM celesta): high bell accents (E6/G6/A6 fit every chord) ---
const sparkPatterns = [
	[N(76, 0, 96, 2)],                                    // P1 single shimmer
	[N(79, 0, 48, 2), N(76, 96, 48, 2)],                  // P2 two-note answer
	[N(76, 144, 12, 1), N(79, 156, 12, 1), N(81, 168, 24, 2)], // P3 run into next bar (also the loop bridge)
	[], [], [], [], [],
];

// --- Drums (drumset): 0 kick, 1 snare, 5 closed hat, 7 open hat, 9 crash ---
// IMPORTANT: BeepBox's serialized format is strictly sequential — a note always
// starts where the previous one ended (plus an optional rest). Simultaneous
// drum hits MUST be one note with multiple pitches (a "chord" of drums).
const K = 0, SN = 1, CH = 5, OH = 7, CR = 9;
const drumPatterns = [
	// P1 groove A: kick 1&3, snare 2&4, 8th hats
	[N([K,CH], 0, 24, 3), N(CH, 24, 24, 1), N([SN,CH], 48, 24, 3), N(CH, 72, 24, 1),
	 N([K,CH], 96, 24, 3), N(CH, 120, 24, 1), N([SN,CH], 144, 24, 3), N(CH, 168, 24, 1)],
	// P2 groove B: ghost kick & open hat at the end
	[N([K,CH], 0, 24, 3), N(CH, 24, 24, 1), N([SN,CH], 48, 24, 3), N(CH, 72, 24, 1),
	 N([K,CH], 96, 24, 3), N(CH, 120, 24, 1), N([SN,CH], 144, 24, 3), N([K,OH], 168, 24, 2)],
	// P3 fill: snare roll (16ths) into next bar
	[N([K,CH], 0, 24, 3), N(CH, 24, 24, 1), N([SN,CH], 48, 24, 2), N(CH, 72, 24, 1),
	 N(CH, 96, 24, 2), N(CH, 120, 24, 1),
	 N(SN, 144, 6, 1), N(SN, 150, 6, 1), N(SN, 156, 6, 2), N(SN, 162, 6, 2),
	 N(SN, 168, 6, 2), N(SN, 174, 6, 3), N(SN, 180, 6, 3), N(SN, 186, 6, 3)],
	// P4 soft: brushed kicks only
	[N(K, 0, 48, 2), N(CH, 48, 48, 1), N(K, 96, 48, 2), N(CH, 144, 48, 1)],
	[], [], [], [],
];

// The original 24-bar song, then that same song again from the melody onward,
// then its second half once more. 24 + 20 + 16 = 60 bars. The last four bars
// are the original turnaround, which falls into bar 1.
const SONG = {
	box:   [1,2,3,4, 1,2,3,4, 2,4,5,1, 2,3,4,4, 6,6,7,4, 1,2,3,4],
	pad:   [1,2,3,4, 1,2,3,4, 2,4,5,1, 2,3,4,4, 1,5,2,6, 1,2,3,4],
	lead:  [0,0,0,0, 1,2,3,4, 5,6,7,8, 2,3,4,6, 0,0,0,0, 1,2,3,4],
	bass:  [0,0,3,4, 1,2,3,4, 2,4,5,1, 2,3,4,4, 1,5,2,4, 1,2,3,4],
	spark: [0,1,0,1, 0,0,0,3, 0,2,0,0, 0,0,0,3, 1,0,0,3, 0,2,0,3],
	drums: [0,0,4,4, 1,1,1,2, 1,1,1,3, 1,1,1,2, 4,0,4,0, 1,1,1,3],
};
const BARS = Object.fromEntries(Object.entries(SONG).map(([name, bars]) => [
	name,
	[...bars, ...bars.slice(4), ...bars.slice(8)],
]));

// ============================================================================
// INSTRUMENTS
// ============================================================================

// "music box 1" preset (picked string), converted to internal values
const musicBox = {
	type: TYPE.pickedString, volume: 1, preset: 0,
	eqFilter: [{ type: 0, freq: 25, gain: 5 }], // low-pass ~4757Hz, 0.5 gain
	effects: 1 << FX.reverb, reverb: 1,
	fadeIn: 0, fadeOut: FADE.t48,
	harmonics: [7,0,0,7,0,0,0,0,0,0,7,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,5,0],
	unison: 0, stringSustain: 9, stringSustainType: 0,
	envelopes: [],
};

// "warm pad" preset (FM), note filter + chorus
const dreamPad = {
	type: TYPE.fm, volume: 1, preset: 0,
	eqFilter: [],
	effects: (1 << FX.noteFilter) | (1 << FX.chorus),
	noteFilter: [{ type: 0, freq: 23, gain: 7 }], // low-pass ~3364Hz
	chorus: 3,
	fadeIn: 4, fadeOut: FADE.t96, // ~0.0575s attack, long release
	algorithm: 0, feedbackType: 0, feedbackAmplitude: 7,
	opFreq: [0, 0, 0, 0], opAmp: [14, 6, 0, 0],
	envelopes: [
		{ target: TARGET.noteFilterAllFreqs, index: 0, envelope: ENV.swell3 },
		{ target: TARGET.operatorAmplitude, index: 1, envelope: ENV.swell1 },
	],
};

// "crystal" preset (FM) + echo & light vibrato — the lead voice
const lead = {
	type: TYPE.fm, volume: 0, preset: 0,
	eqFilter: [],
	effects: (1 << FX.reverb) | (1 << FX.echo) | (1 << FX.vibrato),
	vibrato: 1, echoSustain: 3, echoDelay: 5, reverb: 1, // echo delay = (5+1)*4 ticks = 0.5 beat
	fadeIn: 0, fadeOut: FADE.t12,
	algorithm: 12, feedbackType: 8, feedbackAmplitude: 4, // "1 2 3 4", "1⟲ 2⟲ 3⟲ 4⟲"
	opFreq: [0, 4, 7, 12], opAmp: [10, 7, 4, 4], // 1×, 3×, 6×, 13×
	envelopes: [],
};

// soft triangle bass, low-passed
const bass = {
	type: TYPE.chip, volume: 1, preset: 0,
	eqFilter: [{ type: 0, freq: 17, gain: 7 }], // low-pass ~1200Hz
	effects: 1 << FX.reverb, reverb: 1,
	fadeIn: 0, fadeOut: FADE.t12,
	chipWave: 1, unison: 0, // triangle
	envelopes: [],
};

// "celesta"-like sparkle (FM) with echo
const sparkle = {
	type: TYPE.fm, volume: 2, preset: 0,
	eqFilter: [{ type: 0, freq: 26, gain: 5 }], // low-pass ~5657Hz
	effects: (1 << FX.reverb) | (1 << FX.echo),
	echoSustain: 4, echoDelay: 5, reverb: 2,
	fadeIn: 0, fadeOut: FADE.t48,
	algorithm: 9, feedbackType: 4, feedbackAmplitude: 0, // "(1 2)←(3 4)", "1⟲ 2⟲"
	opFreq: [1, 9, 14, 4], opAmp: [11, 6, 3, 1], // ~1×, 8×, 20×, 3×
	envelopes: [
		{ target: TARGET.operatorAmplitude, index: 2, envelope: ENV.twang1 },
		{ target: TARGET.operatorAmplitude, index: 3, envelope: ENV.twang2 },
	],
};

// "standard drumset" preset spectra (converted from 0-100 to 0-7)
const drums = {
	type: TYPE.drumset, volume: 1, preset: 0,
	eqFilter: [],
	effects: 1 << FX.reverb, reverb: 1,
	drumsetEnvelopes: [ENV.twang1, ENV.twang1, ENV.twang1, ENV.twang1, ENV.decay2, ENV.decay1, ENV.twang3, ENV.decay3, ENV.twang3, ENV.decay3, ENV.flare1, ENV.decay2],
	drumsetSpectrum: [
		[4,5,5,6,6,6,5,5,5,5,4,4,4,4,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2], // 0 kick
		[0,0,0,7,5,5,4,6,4,4,4,5,3,3,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3], // 1 snare
		[0,0,0,0,7,4,3,3,2,4,3,2,5,3,3,3,3,4,3,3,3,3,3,3,3,3,2,3,3,3], // 2 tom low
		[0,0,0,0,0,5,4,3,3,3,4,4,3,2,4,3,3,3,2,3,4,3,3,3,3,3,3,2,3,3], // 3 tom mid
		[0,1,2,3,6,5,2,3,3,3,3,2,5,2,5,2,3,3,3,3,4,3,3,4,3,3,3,4,4,4], // 4 clap/snare
		[0,0,1,1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,5,5,5,5,5,4,4,4,4,3,3,3], // 5 closed hat
		[3,3,3,5,2,2,3,3,3,2,3,3,3,2,2,3,3,2,2,2,4,1,4,3,3,4,3,3,4,4], // 6 floor tom
		[2,3,3,3,3,2,2,3,2,2,3,2,1,2,3,2,3,2,4,2,3,4,3,5,3,5,4,4,5,5], // 7 open hat
		[3,2,2,3,2,2,2,4,2,2,2,4,3,3,2,2,4,3,3,3,5,3,3,5,4,5,5,5,5,5], // 8 ride
		[4,4,4,3,4,4,3,3,4,3,3,3,5,4,3,4,6,5,4,6,5,4,6,7,5,6,6,6,6,6], // 9 crash
		[0,0,1,1,1,1,2,2,2,3,3,3,4,4,5,5,6,6,7,7,7,7,7,7,7,7,6,4,2,0], // 10 shaker/sweep
		[1,1,1,1,2,1,1,2,1,3,1,3,4,6,4,4,7,4,3,3,4,7,4,3,2,1,0,0,0,0], // 11 tambourine/clap
	],
	envelopes: [],
};

// ============================================================================
// SONG ASSEMBLY
// ============================================================================

const song = {
	pitchChannelCount: 5,
	noiseChannelCount: 1,
	scale: 6, // "normal :)" ionian
	key: 0,   // C
	loopStart: 0,
	loopLength: 60,
	tempo: 96,
	beatsPerBar: 8,
	barCount: 60,
	patternsPerChannel: 8,
	rhythm: 1, // ÷4 (standard)
	channels: [
		{ octave: 4, instruments: [musicBox], patterns: boxPatterns,   bars: BARS.box },
		{ octave: 3, instruments: [dreamPad], patterns: padPatterns,   bars: BARS.pad },
		{ octave: 4, instruments: [lead],     patterns: leadPatterns,  bars: BARS.lead },
		{ octave: 2, instruments: [bass],     patterns: bassPatterns,  bars: BARS.bass },
		{ octave: 5, instruments: [sparkle],  patterns: sparkPatterns, bars: BARS.spark },
		{ octave: 0, instruments: [drums],    patterns: drumPatterns,  bars: BARS.drums },
	],
};

// ============================================================================
// SERIALIZER — exact port of Song.toBase64String() (version 9)
// ============================================================================

function serialize(song) {
	const buffer = [];
	const push = (s) => { for (const ch of s) buffer.push(ch.charCodeAt(0)); };
	const pushB = (v) => buffer.push(base64IntToCharCode[v]);

	pushB(9); // version 9
	push('n'); pushB(song.pitchChannelCount); pushB(song.noiseChannelCount);
	push('s'); pushB(song.scale);
	push('k'); pushB(song.key);
	push('l'); pushB(song.loopStart >> 6); pushB(song.loopStart & 0x3f);
	push('e'); pushB((song.loopLength - 1) >> 6); pushB((song.loopLength - 1) & 0x3f);
	push('t'); pushB(song.tempo >> 6); pushB(song.tempo & 63);
	push('a'); pushB(song.beatsPerBar - 1);
	push('g'); pushB((song.barCount - 1) >> 6); pushB((song.barCount - 1) & 0x3f);
	push('j'); pushB((song.patternsPerChannel - 1) >> 6); pushB((song.patternsPerChannel - 1) & 0x3f);
	push('r'); pushB(song.rhythm);

	push('i'); pushB(0); // no layered/pattern instruments

	push('o');
	for (let c = 0; c < song.pitchChannelCount; c++) pushB(song.channels[c].octave);

	// --- instruments ---
	for (const channel of song.channels) {
		for (const inst of channel.instruments) {
			push('T'); pushB(inst.type);
			push('v'); pushB(inst.volume);
			push('u'); pushB(inst.preset >> 6); pushB(inst.preset & 63);

			push('f'); pushB(inst.eqFilter.length);
			for (const p of inst.eqFilter) { pushB(p.type); pushB(p.freq); pushB(p.gain); }

			push('q'); pushB(inst.effects >> 6); pushB(inst.effects & 63);
			const has = (e) => (inst.effects & (1 << e)) !== 0;
			if (has(FX.noteFilter)) { pushB(inst.noteFilter.length); for (const p of inst.noteFilter) { pushB(p.type); pushB(p.freq); pushB(p.gain); } }
			if (has(FX.transition)) pushB(inst.transition);
			if (has(FX.chord)) pushB(inst.chord);
			if (has(FX.pitchShift)) pushB(inst.pitchShift);
			if (has(FX.detune)) pushB(inst.detune);
			if (has(FX.vibrato)) pushB(inst.vibrato);
			if (has(FX.distortion)) pushB(inst.distortion);
			if (has(FX.bitcrusher)) { pushB(inst.bitcrusherFreq); pushB(inst.bitcrusherQuantization); }
			if (has(FX.panning)) pushB(inst.pan);
			if (has(FX.chorus)) pushB(inst.chorus);
			if (has(FX.echo)) { pushB(inst.echoSustain); pushB(inst.echoDelay); }
			if (has(FX.reverb)) pushB(inst.reverb);

			if (inst.type !== TYPE.drumset) { push('d'); pushB(inst.fadeIn); pushB(inst.fadeOut); }

			if (inst.type === TYPE.harmonics || inst.type === TYPE.pickedString) {
				push('H');
				const hb = new BitFieldWriter();
				for (let i = 0; i < 28; i++) hb.write(3, inst.harmonics[i]);
				hb.encodeBase64(buffer);
			}

			if (inst.type === TYPE.chip) {
				push('w'); pushB(inst.chipWave); push('h'); pushB(inst.unison);
			} else if (inst.type === TYPE.fm) {
				push('A'); pushB(inst.algorithm);
				push('F'); pushB(inst.feedbackType);
				push('B'); pushB(inst.feedbackAmplitude);
				push('Q'); for (const f of inst.opFreq) pushB(f);
				push('P'); for (const a of inst.opAmp) pushB(a);
			} else if (inst.type === TYPE.noise) {
				push('w'); pushB(inst.chipNoise);
			} else if (inst.type === TYPE.drumset) {
				push('z'); for (const e of inst.drumsetEnvelopes) pushB(e);
				push('S');
				const sb = new BitFieldWriter();
				for (let j = 0; j < 12; j++) for (let i = 0; i < 30; i++) sb.write(3, inst.drumsetSpectrum[j][i]);
				sb.encodeBase64(buffer);
			} else if (inst.type === TYPE.pickedString) {
				push('h'); pushB(inst.unison);
				push('I'); pushB(inst.stringSustain | (inst.stringSustainType << 5));
			} else {
				throw new Error("unsupported instrument type " + inst.type);
			}

			push('E'); pushB(inst.envelopes.length);
			for (const env of inst.envelopes) {
				pushB(env.target);
				if (TARGET_MAX_COUNT[env.target] > 1) pushB(env.index);
				pushB(env.envelope);
			}
		}
	}

	// --- bars (pattern sequence per channel) ---
	push('b');
	{
		const bits = new BitFieldWriter();
		let neededBits = 0;
		while ((1 << neededBits) < song.patternsPerChannel + 1) neededBits++;
		for (const channel of song.channels) for (let i = 0; i < song.barCount; i++) bits.write(neededBits, channel.bars[i]);
		bits.encodeBase64(buffer);
	}

	// --- patterns (notes) ---
	push('p');
	{
		const bits = new BitFieldWriter();
		const shapeBits = new BitFieldWriter();
		const partsPerBar = song.beatsPerBar * PARTS_PER_BEAT;

		// Validate: the format is strictly sequential — notes may not overlap,
		// and every pattern's content must fit exactly within one bar.
		for (let ci = 0; ci < song.channels.length; ci++) {
			for (let pi = 0; pi < song.channels[ci].patterns.length; pi++) {
				let cur = 0;
				for (const note of song.channels[ci].patterns[pi]) {
					if (note.pitches.length > MAX_CHORD_SIZE) throw new Error(`ch ${ci} pat ${pi+1}: chord too big`);
					if (note.start < cur) throw new Error(`ch ${ci} pat ${pi+1}: overlapping note at ${note.start} (prev ends ${cur})`);
					if (note.end > partsPerBar) throw new Error(`ch ${ci} pat ${pi+1}: note past bar end (${note.end} > ${partsPerBar})`);
					for (const p of note.pitches) if (p < 0 || p > 84) throw new Error(`ch ${ci} pat ${pi+1}: pitch ${p} out of range`);
					cur = note.end;
				}
			}
		}

		for (let ci = 0; ci < song.channels.length; ci++) {
			const channel = song.channels[ci];
			const isNoise = ci >= song.pitchChannelCount;
			const octaveOffset = isNoise ? 0 : channel.octave * 12;
			let lastPitch = isNoise ? 4 : octaveOffset;
			const recentPitches = (isNoise ? [4,6,7,2,3,8,0,10] : [0,7,12,19,24,-5,-12]).map(p => p + octaveOffset);
			const recentShapes = [];

			for (const pattern of channel.patterns) {
				if (pattern.length > 0) {
					bits.write(1, 1);
					let curPart = 0;
					for (const note of pattern) {
						if (note.start > curPart) { bits.write(2, 0); bits.writePartDuration(note.start - curPart); }

						shapeBits.clear();
						for (let i = 1; i < note.pitches.length; i++) shapeBits.write(1, 1);
						if (note.pitches.length < MAX_CHORD_SIZE) shapeBits.write(1, 0);
						shapeBits.writePinCount(note.pins.length - 1);
						shapeBits.write(BITS_PER_NOTE_SIZE, note.pins[0].size);
						let shapePart = 0;
						const startPitch = note.pitches[0];
						let currentPitch = startPitch;
						const pitchBends = [];
						for (let i = 1; i < note.pins.length; i++) {
							const pin = note.pins[i];
							const nextPitch = startPitch + pin.interval;
							if (currentPitch !== nextPitch) { shapeBits.write(1, 1); pitchBends.push(nextPitch); currentPitch = nextPitch; }
							else shapeBits.write(1, 0);
							shapeBits.writePartDuration(pin.time - shapePart);
							shapePart = pin.time;
							shapeBits.write(BITS_PER_NOTE_SIZE, pin.size);
						}

						const shapeString = String.fromCharCode.apply(null, shapeBits.encodeBase64([]));
						const shapeIndex = recentShapes.indexOf(shapeString);
						if (shapeIndex === -1) { bits.write(2, 1); bits.concat(shapeBits); }
						else { bits.write(1, 1); bits.writeLongTail(0, 0, shapeIndex); recentShapes.splice(shapeIndex, 1); }
						recentShapes.unshift(shapeString);
						if (recentShapes.length > 10) recentShapes.pop();

						const allPitches = note.pitches.concat(pitchBends);
						for (let i = 0; i < allPitches.length; i++) {
							const pitch = allPitches[i];
							const pitchIndex = recentPitches.indexOf(pitch);
							if (pitchIndex === -1) {
								let interval = 0, pitchIter = lastPitch;
								if (pitchIter < pitch) { while (pitchIter !== pitch) { pitchIter++; if (recentPitches.indexOf(pitchIter) === -1) interval++; } }
								else { while (pitchIter !== pitch) { pitchIter--; if (recentPitches.indexOf(pitchIter) === -1) interval--; } }
								bits.write(1, 0);
								bits.writePitchInterval(interval);
							} else {
								bits.write(1, 1);
								bits.write(3, pitchIndex);
								recentPitches.splice(pitchIndex, 1);
							}
							recentPitches.unshift(pitch);
							if (recentPitches.length > 8) recentPitches.pop();
							if (i === note.pitches.length - 1) lastPitch = note.pitches[0];
							else lastPitch = pitch;
						}

						if (note.start === 0) bits.write(1, note.continuesLastPattern ? 1 : 0);
						curPart = note.end;
					}
					if (curPart < partsPerBar) { bits.write(2, 0); bits.writePartDuration(partsPerBar - curPart); }
				} else {
					bits.write(1, 0);
				}
			}
		}

		let stringLength = bits.lengthBase64();
		const digits = [];
		while (stringLength > 0) { digits.unshift(base64IntToCharCode[stringLength & 0x3f]); stringLength = stringLength >> 6; }
		buffer.push(base64IntToCharCode[digits.length]);
		for (const d of digits) buffer.push(d);
		bits.encodeBase64(buffer);
	}

	return String.fromCharCode.apply(null, buffer);
}

for (const channel of song.channels) {
	if (channel.patterns.length !== song.patternsPerChannel) {
		throw new Error(`pattern count ${channel.patterns.length} != ${song.patternsPerChannel}`);
	}
	if (channel.bars.length !== song.barCount) {
		throw new Error(`bar count ${channel.bars.length} != ${song.barCount}`);
	}
}

const hash = serialize(song);
const url = "https://www.beepbox.co/#" + hash;
writeFileSync(new URL("./beepbox-somnia-theme.url", import.meta.url), url + "\n");
console.log("Song hash length:", hash.length, "chars");
console.log("URL length:", url.length, "chars");
console.log("Wrote scripts/beepbox-somnia-theme.url");
