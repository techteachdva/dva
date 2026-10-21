/**
 * What the mentors say around each level (js/data/levels.js). Lines are strings or [mood, text]
 * (moods: neutral, pleased, worried, special, rot; see ui/dialogue.js).
 *
 *   INTRO[district]        first visit, before level 1
 *   LINES[levelId].open    when the level starts (its morphemes light up around the room)
 *   LINES[levelId].build   when the last morpheme is earned and the dials load
 *   LINES[levelId].clear   when the level's Rotlings are debugged
 *   EARNED[district]       one-liners for earning a morpheme, used in turn
 *   DONE / REPEAT          after the last level; talking to the mentor once the levels are done
 *
 * Voices. Old Wynn talks in short, old words and never counts right; every level brings one more
 * part of her arcade cabinet, the Unbreakable, back to life. Aurelia Cache speaks in long Latin
 * words with holes where the Rot ate her roots; each level fills a hole, and her secret leaks out.
 * Theo Parsec talks fast, renames satellites after whatever you just built, and is racing an
 * eclipse that gets closer every level. Nobody explains a rule the next minigame will show.
 */

export const INTRO = {
  anglo: [
    ['special', 'Mind the cable. No, the other cable.'],
    'So you are the new Morpher. They said they would send help. One bot. Two bots. Hm. Still one.',
    'I am Wynn. Old Wynn, they call me, but I was here first, so I get to be old.',
    ['worried', 'The Rot broke my words. Now the bits lie about the floor and glow, and I cannot bend down. See those lights? Go and win them back.'],
  ],
  latin: [
    'Ah. A visitor. Do forgive the... the... there is a word for the state of this room.',
    ['special', 'Dis-something. I had the root. The Rot ate it, along with half of my archive.'],
    'I am Aurelia Cache, and I keep the records of every Latin word English ever borrowed. Kept. Keep. It depends on the day.',
    'Bring my roots home and my memory comes back with them. Each glowing light in this room is one of them.',
  ],
  greek: [
    ['special', 'You\'re here! Great! Terrible timing! Hello!'],
    'Theo Parsec. I run this array. There\'s an eclipse in twelve minutes, and when it hits, the uplink goes dark until the next one.',
    ['worried', 'The Rot scrambled my star map. Every word I need to fix it is in bits all over the deck.'],
    'Grab the glowing ones. Greek parts click together like satellite modules. You\'ll feel it.',
  ],
};

export const LINES = {
  // ── Old Wynn ────────────────────────────────────────────────────
  'anglo-1': {
    open: ['That box by the wall is the Unbreakable. Best cabinet ever built. It is broken.', 'Bring me care, help and hope first. Words that keep things going.'],
    build: ['Good. Now stick them together. A word for a bot like me: help plus... you will see.'],
    clear: [['pleased', 'The screen came on! One light. Two lights. Three. Close enough.']],
  },
  'anglo-2': {
    open: ['Kind, happy, friend. I had all three once. Then I had a cabinet instead.'],
    build: ['Put endings on them. -ness makes a thing you can hold. -ship makes a thing you share.'],
    clear: [['pleased', 'The joystick moves again. I kicked it twice to be sure. Friendly kick.']],
  },
  'anglo-3': {
    open: ['Run, play, sing. Kid words. The Unbreakable made kids do all three at once.'],
    clear: [['special', 'Coin slot works. It ate my bolt. I did not want that bolt back anyway.']],
  },
  'anglo-4': {
    open: [['worried', 'It got dark in here. Too dark. Some of these words can fix that.']],
    build: ['-en means to make it so. Dark to darken. Bright to... you know this one.'],
    clear: [['pleased', 'The sound board! It plays four notes. It used to play five. I count four. Maybe five.']],
  },
  'anglo-5': {
    open: ['Last of my words. Fear, sleep, child. I was built in the childhood of the net, you know.', 'Do not look at me like that. Get the lights.'],
    clear: [
      ['special', 'HIGH SCORE. The board lit up. Somebody beat me in nineteen eighty... something.'],
      'The Unbreakable works. Thank you, Morpher. One. You are one good bot.',
    ],
  },

  // ── Aurelia Cache ───────────────────────────────────────────────
  'latin-1': {
    open: ['My first memory. A ship, a harbor, men carrying goods across the water. They had a word for carrying. ___. It is right there.', 'And a word for looking. And for throwing. Find them.'],
    build: ['Port. Of course it was port. Carry. Now, a prefix sends the carrying somewhere. Out, in, under, back.'],
    clear: [['pleased', 'Import. Export. Report. I can see the harbor again, and every crate has a label.']],
  },
  'latin-2': {
    open: [['worried', 'This one hurts. I remember something breaking. Something I broke. The root for breaking is out there, glowing like nothing happened.']],
    build: ['Rupt. Break. Put something between it and you get interrupt, which is what I am doing to my own story.'],
    clear: ['Contract, extract, intercept. Pulled together, pulled out, caught between.', ['special', 'I will tell you about the breaking. Not yet. Soon.']],
  },
  'latin-3': {
    open: ['Before the Rot I could say what would happen next. Predict, we called it. Now I cannot even say the word.'],
    clear: [['pleased', 'Dict. Say. I can predict again. I predict you will want a snack after this.']],
  },
  'latin-4': {
    open: ['Seeing. Sending. Standing. Three verbs, and the Rot took all three from the same shelf. Tidy of it.'],
    clear: ['Vision. Mission. Station. The archive has a floor plan again, and it is beautiful.'],
  },
  'latin-5': {
    open: ['Some roots wear more than one spelling. Duct, duce. Scribe, scrib. Same meaning, different clothes.', 'You will win one and its twin comes with it.'],
    clear: [['pleased', 'Produce, introduce, describe. I can introduce myself properly now. I am Aurelia Cache. I am... mostly here.']],
  },
  'latin-6': {
    open: ['Building. Holding. Standing firm. Struct, tain, sist. These were the bones of the archive.'],
    build: ['Ad changes shape to fit. Ad and sist become assist. It holds the door for the next letter.'],
    clear: ['Construct. Contain. Persist. That last one is what you are doing, and I notice.'],
  },
  'latin-7': {
    open: ['A place where things are made needs a word. So does the one who makes them. The endings are out there.'],
    clear: [['special', 'Factory. Factor. Motor. Motion. I remember the noise of it all. I miss the noise.']],
  },
  'latin-8': {
    open: ['Watch over. Make. Fold. Odd neighbors on one shelf, but they always got along.'],
    clear: [['worried', 'Infect. That word sits wrong with me. That is how the Rot got in. Through a word I made.']],
  },
  'latin-9': {
    open: [['special', 'All right. The truth. I built a word that was not real. I pushed it into the core to see what it would do.'], 'It took. It took everything. That was the Rot.'],
    build: ['Ceive, ceit. To take. Deceive is to take someone in. I deceived myself that it was harmless.'],
    clear: [['pleased', 'Receive. Reform. Conform. You do not hate me. I can tell. Your words are kind ones.']],
  },
  'latin-10': {
    open: ['Three dials now. Do not let it frighten you. A word can be prefix, base and ending at once, like a person can be three things at once.'],
    clear: ['Difference. Different. Continent. A whole continent from a root that means hold together. That is Latin for you.'],
  },
  'latin-11': {
    open: ['Writing. Seeing ahead. Putting things in place. Pos, pose, pon: three spellings of one idea, and they all come home together.'],
    clear: [['special', 'Postpone. I postponed telling you for eight levels. Do not postpone things. That is the lesson. Also the word.']],
  },
  'latin-12': {
    open: ['Seizing and placing. Capt, posit, ten. A thief, a builder and a jailer walk into an archive.'],
    clear: ['Capture. Position. Positive. I am positive about very little these days, but I am positive about you.'],
  },
  'latin-13': {
    open: ['My last shelf. Watchers, speakers and the book that holds what words say.'],
    clear: [
      ['pleased', 'Dictionary. A place for what is said. That is what I was. That is what I am again.'],
      'Every root is home. The archive hums. Go on, Morpher. The firewall knows you.',
    ],
  },

  // ── Theo Parsec ─────────────────────────────────────────────────
  'greek-1': {
    open: [['worried', 'Eclipse in eleven minutes!'], 'I need words for seeing far, writing light, and doing things yourself. Auto, photo, tele. Grab them!'],
    build: ['Greek bases snap together like modules. Two bases, one word. Telescope! Photograph! I\'m naming a satellite Autograph.'],
    clear: [['special', 'Telescope back online. I can see the star I named Gary. Gary is fine.']],
  },
  'greek-2': {
    open: ['Ten minutes. Measuring and drawing and talking. A map is just a drawing with an attitude.'],
    clear: [['pleased', 'Diagram, diameter, dialogue! Dia means across. I\'ve been saying it wrong my whole life. Across! Of course!']],
  },
  'greek-3': {
    open: ['Nine minutes. Same, against, together. These go on the front of words, like a nose cone.'],
    clear: ['Synonym, antonym, homophone. Three new satellites. Synonym and Antonym aren\'t speaking to each other.'],
  },
  'greek-4': {
    open: [['worried', 'Eight minutes, and now there are three dials. Earth, home, the study of. Breathe. I\'m breathing.']],
    build: ['Sometimes a linking o holds two Greek parts together. It sits on its own ring. Leave it be. It\'s doing its best.'],
    clear: [['pleased', 'Geology, ecology, economy. I can see the planet\'s home systems again. Everyone\'s home. Hi, home!']],
  },
  'greek-5': {
    open: ['Seven minutes. Nature, sound, writing, and the endings that turn them into subjects you take at school.'],
    clear: ['Physics! Phonics! Graphics! Every class on my schedule was Greek all along and nobody told me.'],
  },
  'greek-6': {
    open: ['Six minutes. Stars and animals. That\'s basically the whole job.'],
    clear: [['special', 'Astronomer. That\'s me. I\'m the astronomer. I\'m naming a satellite Theo. No. Too much. Theo Two.']],
  },
  'greek-7': {
    open: ['Five minutes. The universe, wheels, and heroes. Big words for a small deck.'],
    clear: [['pleased', 'Cosmic! Heroic! You\'re a hero, I\'m a cyclist, the universe is cosmic. Everything checks out.']],
  },
  'greek-8': {
    open: [['worried', 'Four minutes. Humans, feelings, wisdom. The map\'s people layer is completely dark.']],
    clear: ['Anthropology. Pathology. The study of humans and the study of what hurts them. I\'m less scared now. Weird.'],
  },
  'greek-9': {
    open: ['Three minutes! Heart, nerves, and the rest of my star map is a body chart for some reason. Don\'t ask.'],
    clear: [['pleased', 'Cardiology. My heart rate is very high. Neurology. My nerves are shot. Both perfectly named.']],
  },
  'greek-10': {
    open: [['worried', 'Two minutes. Under, over, skin, heat. The array is overheating and freezing at the same time. Somehow.']],
    clear: ['Hyperthermia, hypothermia. Too hot, too cold. You fixed both. I\'ll name the next one Just Right.'],
  },
  'greek-11': {
    open: [['special', 'One minute! The last words! Love, wisdom, shape, study. Go go go!']],
    clear: [
      ['pleased', 'The eclipse is here, and the uplink is holding! Philosophy! Morphology! That second one\'s about you, you know. The study of shapes. Of words.'],
      'Star map saved. I\'m naming the brightest one after you. You can\'t stop me.',
    ],
  },
};

export const EARNED = {
  anglo: [
    'That one is back. One. Or is it two now. Keep going.',
    'Good. I heard the cabinet click when you got that.',
    'Ha. You play games better than I do. Do not tell anyone.',
    ['special', 'There. Now that bit is a word again, not just a light on my floor.'],
  ],
  latin: [
    'Ah. I remember that one. It was on the third shelf.',
    ['pleased', 'Another line of my log, restored. It reads better than I remember.'],
    'You do the meaning and the meaning sticks. That is how I learned them too.',
    'One more root home. The archive is less hollow.',
  ],
  greek: [
    ['pleased', 'Got it! Logged it! Naming a satellite after it! Not that one. That one\'s taken.'],
    'That part\'s live again. The map just lit up a little.',
    'Nice! Greek pieces love company. That one\'s already looking for a partner.',
    ['worried', 'Faster would be great. No pressure. Some pressure. The eclipse pressure.'],
  ],
};

export const DONE = {
  anglo: ['That is all my words. The glowing firewall wants a sentence fixed. Pick the ending that fits.', 'And try the Word Lab in the Hub some time. Build anything. Some of it will even be real.'],
  latin: ['The firewall will ask you for endings. In the next hall the Rotlings breed if you dawdle. Mind the meter.'],
  greek: ['The firewall wants the right ending. Then the deck! Rotlings! Go!'],
};

export const REPEAT = {
  anglo: ['Firewall. Sentence. Ending. Go on.'],
  latin: ['The firewall lock, then the hall. Keep an eye on the meter.'],
  greek: ['Firewall first, then the Rotlings. Then the uplink. Then I\'ll calm down.'],
};
