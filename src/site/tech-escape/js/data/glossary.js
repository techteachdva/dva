/**
 * Plain-language definitions for grades 6–8.
 *
 * Shown before a question or phone scene is ready to answer, and only for
 * words that actually appear in that item. A sixth grader should not have to
 * guess what a term means in order to attempt the question.
 */

const GLOSSARY = [
  {
    term: 'The four design steps',
    test: /\b(DEFINE|PREPARE|TRY|REFLECT)\b/,
    def: 'DEFINE means name the problem and who has it. PREPARE means plan and sketch. TRY means build a test version and watch someone use it. REFLECT means decide what worked and what to change.',
  },
  {
    term: 'Inquiry question',
    test: /\binquiry question\b/i,
    def: 'An inquiry question is the question your research is trying to answer. It should need more than one source, and it should be small enough to finish.',
  },
  {
    term: 'Digital footprint',
    test: /\bdigital footprint\b/i,
    def: 'A digital footprint is the trail you leave online: posts, photos, comments, and other traces people can still find later.',
  },
  {
    term: 'Intellectual property',
    test: /\bintellectual property\b/i,
    def: 'Intellectual property is work someone made, like a photo, song, or story, and the right to decide how other people copy it.',
  },
  {
    term: 'Copyright',
    test: /\bcopyright\b/i,
    def: 'Copyright means the maker of a photo, song, or story gets a say in how it is copied. Using it in a school project still needs permission or a license that allows it.',
  },
  {
    term: 'License',
    test: /\blicense\b/i,
    def: 'A license is the set of rules for using someone else’s work. Some licenses say “you may use this in school.” Others say “ask first” or “do not copy.”',
  },
  {
    term: 'Citation',
    test: /\b(citation|cite|cited|citing)\b/i,
    def: 'A citation names where information or a creation came from. Naming the creator is not the same as having permission to copy the work.',
  },
  {
    term: 'Plagiarism',
    test: /\bplagiar/i,
    def: 'Plagiarism means presenting someone else’s words, ideas, or work as if you made them.',
  },
  {
    term: 'Prototype',
    test: /\bprototype\b/i,
    def: 'A prototype is a rough first version of an idea, built so people can try it. It is supposed to be unfinished.',
  },
  {
    term: 'Algorithm',
    test: /\balgorithm\b/i,
    def: 'An algorithm is a list of steps, in order, that someone else could follow to get the same result. A missing step changes the result.',
  },
  {
    term: 'Variable',
    test: /\bvariables?\b/i,
    def: 'A variable is a named spot in a program that holds a value, like a score or a name. The program can read it and change it.',
  },
  {
    term: 'Loop',
    test: /\bloops?\b/i,
    def: 'A loop repeats a set of steps. It needs a way to stop, or it keeps going.',
  },
  {
    term: 'Nested loop',
    test: /\bnested loops?\b/i,
    def: 'A nested loop is a loop inside another loop. The inner one finishes its repeats before the outer one takes its next step.',
  },
  {
    term: 'Conditional',
    test: /\b(conditionals?|if statement)\b/i,
    def: 'A conditional is an if-then rule. The program checks something, then does one set of steps or a different set.',
  },
  {
    term: 'Event',
    test: /\bevents?\b/i,
    when: (blob) => /\b(program|code|click|button|loop|variable)\b/i.test(blob),
    def: 'In a program, an event is a signal the code waits for, such as a click, a key, or a timer. That part of the code runs when the event happens.',
  },
  {
    term: 'Debug',
    test: /\b(debug|debugging|bug)\b/i,
    when: (blob) => /\b(debug|debugging)\b/i.test(blob)
      || (/\bbug\b/i.test(blob) && /\b(code|program|loop)\b/i.test(blob)),
    def: 'A bug is a mistake that makes a program do the wrong thing. Debugging means finding that mistake and fixing it.',
  },
  {
    term: 'Syntax',
    test: /\bsyntax\b/i,
    def: 'Syntax is the spelling and punctuation of code. A syntax error means the computer cannot read the line, even if your idea was right.',
  },
  {
    term: 'Comment',
    test: /\bcomments?\b/i,
    when: (blob) => /\b(code|program|loop)\b/i.test(blob),
    def: 'A comment is a note in a program for humans. The computer skips it when the program runs.',
  },
  {
    term: 'Phishing',
    test: /\bphish/i,
    def: 'Phishing is a fake message that pretends to be a real person or company so you will hand over a password or other private information.',
  },
  {
    term: 'Encrypt',
    test: /\bencrypt/i,
    def: 'Encrypting a message scrambles it so only someone with the key can read it. It is a lock for information, not a way to make a copy disappear.',
  },
  {
    term: 'Credibility',
    test: /\bcredib/i,
    def: 'A credible source is one you have a reason to trust: the author knows the topic, and you can tell where the facts came from.',
  },
  {
    term: 'Bias',
    test: /\bbias/i,
    def: 'Bias is a lean toward one side. A biased source can still contain facts, but it is not the whole picture by itself.',
  },
  {
    term: 'Database',
    test: /\bdatabase\b/i,
    def: 'A database is an organized collection of records, built so you can search and sort them. It is not the same as a random folder of files.',
  },
  {
    term: 'Spreadsheet',
    test: /\bspreadsheet\b/i,
    def: 'A spreadsheet is a grid of rows and columns for numbers and labels. It can sort data and draw charts.',
  },
  {
    term: 'Metadata',
    test: /\bmetadata\b/i,
    def: 'Metadata is information about a file, such as who made it, when, and how big it is. It is not the picture or the song itself.',
  },
  {
    term: 'Firewall',
    test: /\bfirewall\b/i,
    def: 'A firewall is a filter that decides which network traffic may come in or go out. It is not a wall you can see in the room.',
  },
  {
    term: 'Malware',
    test: /\bmalware\b/i,
    def: 'Malware is software made to harm a device or steal from it, including viruses and spyware.',
  },
  {
    term: 'Ransomware',
    test: /\bransomware\b/i,
    def: 'Ransomware is malware that locks your files and demands payment to unlock them. Paying does not guarantee you get the files back.',
  },
  {
    term: 'Two-factor',
    test: /\b(two-factor|2fa|multi-factor)\b/i,
    def: 'Two-factor sign-in asks for two different proofs, such as a password and a code sent to a phone. A stolen password alone is then not enough.',
  },
  {
    term: 'Primary source',
    test: /\bprimary source\b/i,
    def: 'A primary source is a firsthand record, such as data you collected, an interview, or a photo from the event itself.',
  },
  {
    term: 'Open source',
    test: /\bopen source\b/i,
    def: 'Open source software lets people read and reuse the code under a license. Free to download does not always mean open source.',
  },
  {
    term: 'Protocol',
    test: /\bprotocols?\b/i,
    def: 'A protocol is an agreed set of rules for how computers talk to each other, so a message sent one way can be read on the other side.',
  },
  {
    term: 'Server',
    test: /\bservers?\b/i,
    def: 'A server is a computer that stores or delivers something other computers ask for, such as a web page or a shared file.',
  },
  {
    term: 'Pixel',
    test: /\bpixels?\b/i,
    def: 'A pixel is one tiny square of color on a screen. A picture is a grid of pixels.',
  },
  {
    term: 'Bandwidth',
    test: /\bbandwidth\b/i,
    def: 'Bandwidth is how much information a connection can carry at once. A video call needs more than a short text.',
  },
];

/**
 * @param {string} blob  question, options, and preview text
 * @param {string} [authored]  a primer written on the question itself
 * @returns {{term: string, def: string}[]}
 */
export function primersFor(blob, authored = '') {
  const text = String(blob || '');
  const out = [];
  if (authored) out.push({ term: 'Before you answer', def: authored });
  for (const entry of GLOSSARY) {
    if (out.length >= 4) break;
    if (!entry.test.test(text)) continue;
    if (entry.when && !entry.when(text)) continue;
    if (authored && authored.toLowerCase().includes(entry.term.toLowerCase())) continue;
    out.push({ term: entry.term, def: entry.def });
  }
  return out;
}
