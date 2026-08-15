/**
 * The question bank.
 *
 * Four terminals, twelve questions each. Content is drawn from Code.org's
 * middle school CS Discoveries strands and the DEFINE-PREPARE-TRY-REFLECT
 * problem solving process, tagged against the ISTE Standards for Students.
 *
 * Two authoring rules are enforced by hand throughout:
 *
 *   1. Every option in a question is within a few characters of the others, so
 *      "pick the longest answer" is never a winning strategy.
 *   2. Distractors are real misconceptions, not filler. Several questions have
 *      more than one correct answer and say so.
 *
 * `correct` holds indices into `a`. Options are shuffled at runtime, so the
 * order written here does not matter.
 */

export const TERMINALS = [
  {
    name: 'TERMINAL 01 - DESIGN LAB',
    topic: 'The Design Process',
    blurb: 'DEFINE - PREPARE - TRY - REFLECT',
  },
  {
    name: 'TERMINAL 02 - NETWORK CLOSET',
    topic: 'Computing Systems & Networks',
    blurb: 'Hardware, packets, protocols, encryption',
  },
  {
    name: 'TERMINAL 03 - DATA VAULT',
    topic: 'Data, AI & Digital Citizenship',
    blurb: 'Evidence, bias, footprints, ethics',
  },
  {
    name: 'TERMINAL 04 - CODE BAY',
    topic: 'Algorithms & Programming',
    blurb: 'Loops, conditionals, variables, debugging',
  },
];

/* ============================================================================
   TERMINAL 1 - THE DESIGN PROCESS
   ISTE 1.4 Innovative Designer, 1.5 Computational Thinker
   ========================================================================== */

const DESIGN = [
  {
    q: 'In the DEFINE phase, what is your main job?',
    a: [
      'Pin down who has the problem and what success means',
      'Choose the tools, materials, and time your build needs',
      'Create a working model that users can try out',
      'Decide which version of your design performed best',
    ],
    correct: [0],
    why: 'DEFINE is about understanding the problem and the people who have it. Materials belong to PREPARE, a working model is TRY, and judging versions is REFLECT.',
    std: 'ISTE 1.4a Innovative Designer - deliberate design process',
  },
  {
    q: 'Which of these belong in the PREPARE phase?',
    a: [
      'Researching how others have solved similar problems',
      'Listing the materials, steps, and time you will need',
      'Watching a user struggle with your first prototype',
      'Brainstorming and sketching several possible designs',
    ],
    correct: [0, 1, 3],
    why: 'PREPARE is research, planning, and generating ideas before you commit. Watching a user handle a prototype only happens once something exists to test, which is TRY.',
    std: 'ISTE 1.4b Innovative Designer - design and management process',
  },
  {
    q: 'Your prototype fails the first test. In this process, that means:',
    a: [
      'You have useful data about what to change next',
      'You defined the problem incorrectly from the start',
      'You should restart the whole project from scratch',
      'The design process was not followed properly',
    ],
    correct: [0],
    why: 'Failure is information, not a verdict. A failed test tells you which assumption was wrong so the next cycle can be better.',
    std: 'ISTE 1.4d Innovative Designer - tolerance for ambiguity and risk',
  },
  {
    q: 'What makes the design process a cycle instead of a straight line?',
    a: [
      'What you learn in REFLECT sends you back to earlier steps',
      'Every phase must be completely finished before the next begins',
      'The four phases can be completed in any order you like',
      'Teams repeat the TRY phase until the deadline arrives',
    ],
    correct: [0],
    why: 'Reflection feeds the next round. You often return to DEFINE with a sharper problem or to PREPARE with a better plan, which is what makes it iterative.',
    std: 'ISTE 1.4c Innovative Designer - cycles of design',
  },
  {
    q: 'A classmate says "I am in TRY, so I cannot change my plan." Best reply?',
    a: [
      'Testing often reveals plan changes worth making now',
      'Correct, plans are locked once building has started',
      'You should wait for REFLECT to change anything at all',
      'Then you defined your problem too broadly to build',
    ],
    correct: [0],
    why: 'The phases are not locked doors. When a test shows the plan is wrong, changing it immediately is the whole point of prototyping.',
    std: 'ISTE 1.4c Innovative Designer - iterate to improve',
  },
  {
    q: 'Which questions belong in REFLECT?',
    a: [
      'Did our solution meet the needs we wrote down?',
      'What would we change if we built it again?',
      'What materials should we order for the build?',
      'Which parts of our test surprised us the most?',
    ],
    correct: [0, 1, 3],
    why: 'REFLECT compares results against the needs you defined and turns surprises into next steps. Ordering materials is planning, which is PREPARE.',
    std: 'ISTE 1.1c Empowered Learner - reflect to improve practice',
  },
  {
    q: 'Why do designers define constraints such as budget or size early?',
    a: [
      'Constraints shape which solutions are even possible',
      'Constraints guarantee the first prototype will work',
      'Constraints replace the need to test with real users',
      'Constraints let teams skip the planning phase safely',
    ],
    correct: [0],
    why: 'A constraint is a boundary on the solution space. Knowing it early stops you from designing something you could never actually build.',
    std: 'ISTE 1.4a Innovative Designer - constraints and criteria',
  },
  {
    q: 'The best way to learn whether your design solves the problem is to:',
    a: [
      'Watch real users try it and record what happens',
      'Ask your team whether they like the final design',
      'Compare your sketches with the original plan',
      'Check that every material on your list was used',
    ],
    correct: [0],
    why: 'Only the people with the problem can tell you whether it is solved. Your team is too close to the design to judge it fairly.',
    std: 'ISTE 1.4d Innovative Designer - test with users',
  },
  {
    q: 'Interviewing the people affected by a problem happens mostly in:',
    a: [
      'DEFINE, because their needs frame the problem',
      'PREPARE, because they help you gather materials',
      'TRY, because they must operate the prototype',
      'REFLECT, because opinions only matter at the end',
    ],
    correct: [0],
    why: 'You cannot define a problem you have not heard described. Users appear again in TRY and REFLECT, but their needs shape DEFINE first.',
    std: 'ISTE 1.4a Innovative Designer - empathy in design',
  },
  {
    q: 'Iteration means:',
    a: [
      'Improving a design through repeated cycles of testing',
      'Producing many different products at the same time',
      'Following the four phases in the correct order once',
      'Dividing the work so each member owns one phase',
    ],
    correct: [0],
    why: 'Each pass through the cycle uses what the last pass taught you. One trip through the phases is not iteration.',
    std: 'ISTE 1.4c Innovative Designer - iterative cycles',
  },
  {
    q: 'Which are good criteria for judging a design?',
    a: [
      'Measurable, so you can tell if you met them',
      'Written before you start building the thing',
      'Based on the needs of the actual users',
      'Kept vague so any result counts as success',
    ],
    correct: [0, 1, 2],
    why: 'Criteria must be measurable, set in advance, and rooted in user needs. Vague criteria let you declare victory without earning it.',
    std: 'ISTE 1.4a Innovative Designer - criteria for success',
  },
  {
    q: 'Documenting your process as you work matters most because:',
    a: [
      'It lets you explain and repeat what you did',
      'It proves you finished the project on time',
      'It replaces the need for a final prototype',
      'It makes the REFLECT phase optional later',
    ],
    correct: [0],
    why: 'Documentation makes your thinking visible and repeatable, for your team now and for whoever picks the project up next.',
    std: 'ISTE 1.6 Creative Communicator - communicate process clearly',
  },
];

/* ============================================================================
   TERMINAL 2 - COMPUTING SYSTEMS, NETWORKS & THE INTERNET
   ISTE 1.5 Computational Thinker, 1.2 Digital Citizen
   ========================================================================== */

const SYSTEMS = [
  {
    q: 'Data crossing the internet is split into packets mainly because:',
    a: [
      'Small pieces can take separate routes and be reassembled',
      'Packets keep the message hidden from anyone watching',
      'Routers can only hold one complete file at a time',
      'Each packet must arrive in the exact order that it was sent',
    ],
    correct: [0],
    why: 'Splitting data lets pieces travel whichever route is open and get rebuilt at the other end. Packets are not private on their own, and they can arrive out of order.',
    std: 'Code.org NI - Networks & the Internet; ISTE 1.5 Computational Thinker',
  },
  {
    q: 'A protocol is best described as:',
    a: [
      'An agreed set of rules for how devices communicate',
      'A physical cable that connects two computers',
      'A program that speeds up a slow connection',
      'A number that identifies a device on a local network',
    ],
    correct: [0],
    why: 'Protocols are agreements, not hardware. HTTP, TCP, and IP are rulebooks both sides follow so different devices can understand each other.',
    std: 'Code.org NI - protocols and standards',
  },
  {
    q: 'Which of these are hardware?',
    a: [
      'The touchpad you use to move the cursor',
      'The camera lens above your screen',
      'The browser you open to visit a site',
      'The memory chip that holds running data',
    ],
    correct: [0, 1, 3],
    why: 'Hardware is physical. A browser is software: instructions stored on hardware and executed by the processor.',
    std: 'Code.org CS - Computing Systems; hardware and software',
  },
  {
    q: 'Your Chromebook will not join the wifi. Best FIRST troubleshooting step?',
    a: [
      'Check whether other devices can reach the network',
      'Reinstall the operating system from recovery media',
      'Replace the wireless card inside the Chromebook',
      'Email the help desk a full description of it',
    ],
    correct: [0],
    why: 'Good troubleshooting narrows the problem before changing anything. If nothing else can connect either, the fault is the network, not your device.',
    std: 'Code.org CS - systematic troubleshooting',
  },
  {
    q: 'Encryption protects a message by:',
    a: [
      'Scrambling it so only a key can unscramble it',
      'Sending it along a private route no one else uses',
      'Compressing it into a much smaller file size',
      'Deleting it from the server after it arrives',
    ],
    correct: [0],
    why: 'Encryption transforms readable text into ciphertext. Anyone can intercept it, but without the key it is meaningless.',
    std: 'Code.org NI - encryption; ISTE 1.2d Digital Citizen',
  },
  {
    q: 'An IP address is used to:',
    a: [
      'Identify where a device is on a network',
      'Store the websites a person has visited',
      'Encrypt the traffic leaving a computer',
      'Measure how fast a connection is going',
    ],
    correct: [0],
    why: 'An IP address is an address, like a house number for a device, so packets know where to go.',
    std: 'Code.org NI - addressing on the internet',
  },
  {
    q: 'If one router between you and a server fails, usually:',
    a: [
      'Packets travel a different path to the same place',
      'The whole internet becomes unavailable to everyone',
      'Your message is lost and must be typed again',
      'The server assigns your device a new address',
    ],
    correct: [0],
    why: 'The internet is redundant on purpose. Many possible paths mean one broken link reroutes traffic instead of stopping it.',
    std: 'Code.org NI - redundancy and reliability',
  },
  {
    q: 'Which statements about the internet and the web are true?',
    a: [
      'The internet is the network of connected devices',
      'The web is one service that runs on the internet',
      'The web and the internet are two names for one thing',
      'Email can travel the internet without using the web',
    ],
    correct: [0, 1, 3],
    why: 'The internet is the infrastructure. The web is one thing you can do with it, alongside email, games, and video calls.',
    std: 'Code.org NI - internet vs. web',
  },
  {
    q: 'Bandwidth describes:',
    a: [
      'How much data a connection can carry per second',
      'How far a signal can travel before it gets weaker',
      'How many devices a router is able to store',
      'How long a packet waits before it is dropped',
    ],
    correct: [0],
    why: 'Bandwidth is capacity over time. It is why a class of thirty streaming video feels slower than one person doing it.',
    std: 'Code.org NI - bandwidth and latency',
  },
  {
    q: 'Which pairing of input and output is correct?',
    a: [
      'Microphone is input, speaker is output',
      'Monitor is input, keyboard is output',
      'Printer is input, scanner is output',
      'Mouse is input, touchpad is output',
    ],
    correct: [0],
    why: 'Input carries data into the computer, output sends it back out. A mouse and a touchpad are both inputs.',
    std: 'Code.org CS - input, output, storage, processing',
  },
  {
    q: 'Software differs from hardware because software:',
    a: [
      'Is a set of instructions rather than a physical part',
      'Can only be changed by physically opening the computer',
      'Is stored outside the device on a network drive',
      'Runs without needing any hardware to execute it',
    ],
    correct: [0],
    why: 'Software is instructions. It always needs hardware to run on, but you can change it without touching a screwdriver.',
    std: 'Code.org CS - hardware and software relationship',
  },
  {
    q: 'Which are real signs that your connection to a site is secure?',
    a: [
      'The address begins with https rather than http',
      'The browser shows a closed lock in the bar',
      'The page loads faster than it usually does',
      'The site has a professional looking design',
    ],
    correct: [0, 1],
    why: 'HTTPS and the lock indicate the connection is encrypted. Speed and good design say nothing about security, and scam sites often look polished.',
    std: 'ISTE 1.2d Digital Citizen - data privacy and security',
  },
];

/* ============================================================================
   TERMINAL 3 - DATA, AI & DIGITAL CITIZENSHIP
   ISTE 1.2 Digital Citizen, 1.3 Knowledge Constructor
   ========================================================================== */

const DATA = [
  {
    q: 'A survey given only to the robotics club is used to claim what the whole school wants. The flaw is:',
    a: [
      'The sample does not represent the whole school',
      'The sample is too large to analyze correctly',
      'Surveys cannot measure student opinions in any class',
      'The data was collected during the wrong season',
    ],
    correct: [0],
    why: 'A sample has to look like the population you want to describe. One club is a biased slice, no matter how many responses it gives.',
    std: 'Code.org DA - Data & Analysis; ISTE 1.3c Knowledge Constructor',
  },
  {
    q: 'Data becomes information when:',
    a: [
      'It is organized so people can draw meaning from it',
      'It is stored in a database rather than a spreadsheet',
      'It is collected from more than one source',
      'It is converted into binary for a computer',
    ],
    correct: [0],
    why: 'Raw numbers are data. Once organized and interpreted so someone can act on it, it becomes information.',
    std: 'Code.org DA - from data to information',
  },
  {
    q: 'Which help you judge whether a source is trustworthy?',
    a: [
      'Who wrote it and what they might gain',
      'Whether other reliable sources agree',
      'How recently the page was last updated',
      'How high it appears in search results',
    ],
    correct: [0, 1, 2],
    why: 'Author, corroboration, and currency are real signals. Search ranking measures popularity and optimization, not accuracy.',
    std: 'ISTE 1.3a/1.3b Knowledge Constructor - evaluate sources',
  },
  {
    q: 'A model trained mostly on photos of one kind of dog will likely:',
    a: [
      'Struggle to recognize breeds it rarely saw',
      'Recognize every breed with equal accuracy',
      'Refuse to make a prediction when unsure',
      'Retrain itself once it sees a new breed',
    ],
    correct: [0],
    why: 'A model learns the data you feed it. Gaps in the training data become blind spots, which is how bias gets built into AI systems.',
    std: 'Code.org AI - training data and bias; ISTE 1.5 Computational Thinker',
  },
  {
    q: 'Your digital footprint includes:',
    a: [
      'Posts, searches, and data others share about you',
      'Only the accounts you have made public online',
      'Only files stored on your personal computer',
      'Only the messages you sent that were never deleted',
    ],
    correct: [0],
    why: 'Your footprint is bigger than what you post. Services log activity, and other people tag, quote, and upload things about you too.',
    std: 'ISTE 1.2b Digital Citizen - manage digital identity',
  },
  {
    q: 'Which are ethical ways to use an AI writing tool for a school essay?',
    a: [
      'Asking it to explain a concept you found hard',
      'Using it to brainstorm angles you then research',
      'Submitting its paragraphs as your own writing',
      'Checking its claims against reliable sources',
    ],
    correct: [0, 1, 3],
    why: 'Using AI to learn, plan, and verify keeps the thinking yours. Handing in its text as your own is plagiarism, and its claims can be confidently wrong.',
    std: 'ISTE 1.2c Digital Citizen - intellectual property and credit',
  },
  {
    q: 'A bar chart beats a line graph when you want to:',
    a: [
      'Compare amounts across separate categories',
      'Show a value changing steadily over time',
      'Display how parts add up to one whole',
      'Reveal how two variables relate to each other',
    ],
    correct: [0],
    why: 'Bars compare distinct categories. Lines imply continuity over time, pie charts show parts of a whole, scatter plots show relationships.',
    std: 'Code.org DA - visualizing data appropriately',
  },
  {
    q: 'A stranger asks for your school login to "fix" your account. This is:',
    a: [
      'Phishing, and you should report it to an adult',
      'Normal, because tech support needs a password',
      'Spam, which is annoying but always harmless',
      'A bug in the login system worth ignoring',
    ],
    correct: [0],
    why: 'Real support never needs your password. Requests like this are phishing, and reporting them protects everyone on the network.',
    std: 'ISTE 1.2d Digital Citizen - safe and secure practices',
  },
  {
    q: 'Giving credit to a source you used:',
    a: [
      'Lets readers check the evidence for themselves',
      'Is only required when you copy words exactly',
      'Matters mainly for printed books, not for websites',
      'Can be skipped if the source is a free website',
    ],
    correct: [0],
    why: 'Citation is about traceable evidence, not just avoiding trouble. You credit ideas and data too, on any medium, free or not.',
    std: 'ISTE 1.3b Knowledge Constructor; 1.2c - credit others',
  },
  {
    q: 'Which are reasonable ways to reduce bias when collecting data?',
    a: [
      'Ask a group that mirrors the population',
      'Word each question in a neutral way',
      'Collect enough responses to be meaningful',
      'Remove answers that disagree with your idea',
    ],
    correct: [0, 1, 2],
    why: 'Representative sampling, neutral wording, and adequate sample size all reduce bias. Deleting inconvenient responses is the definition of creating it.',
    std: 'Code.org DA - bias in data collection',
  },
  {
    q: 'Metadata is best described as:',
    a: [
      'Data that describes other data',
      'Data that has been fully encrypted',
      'Data copied from another computer',
      'Data that no longer has any use',
    ],
    correct: [0],
    why: 'A photo is data; the time, location, and device stored alongside it are metadata. Metadata can reveal a surprising amount about you.',
    std: 'Code.org DA - metadata; ISTE 1.2d - privacy',
  },
  {
    q: 'The strongest of these passwords is:',
    a: [
      'A long phrase of unrelated words',
      'Your pet name plus your birth year',
      'A short mix of symbols and digits',
      'The same password on every account',
    ],
    correct: [0],
    why: 'Length beats complexity. A long unrelated phrase is hard to crack and easy to remember, while personal details are easy to guess.',
    std: 'ISTE 1.2d Digital Citizen - account security',
  },
];

/* ============================================================================
   TERMINAL 4 - ALGORITHMS & PROGRAMMING
   ISTE 1.5 Computational Thinker
   ========================================================================== */

const CODE = [
  {
    q: 'An algorithm is:',
    a: [
      'A clear sequence of steps that solves a problem',
      'A programming language used to write software',
      'A bug that appears when code runs too fast',
      'A device that carries out a list of instructions',
    ],
    correct: [0],
    why: 'An algorithm is the plan, independent of language. You can write the same algorithm in Python, blocks, or plain English.',
    std: 'Code.org AP - Algorithms & Programming; ISTE 1.5c',
  },
  {
    q: 'A loop is most useful when you need to:',
    a: [
      'Repeat a set of steps without rewriting them',
      'Choose between two or more different paths in code',
      'Store a value that will change over time',
      'Break a program into reusable named parts',
    ],
    correct: [0],
    why: 'Loops handle repetition. Choosing paths is a conditional, storing values is a variable, and naming reusable steps is a function.',
    std: 'Code.org AP - loops',
  },
  {
    q: 'Which statements about variables are true?',
    a: [
      'They hold values that a program can change',
      'They are given names that describe their use',
      'They must be set before they can be read',
      'They can only ever store whole numbers',
    ],
    correct: [0, 1, 2],
    why: 'Variables are named, changeable containers that need a value before you read them. They can hold text, decimals, lists, and more.',
    std: 'Code.org AP - variables',
  },
  {
    q: 'Your loop runs exactly one time too many. This is:',
    a: [
      'An off-by-one error in the loop condition',
      'A syntax error the computer cannot read',
      'A hardware fault in the processor chip',
      'Normal behavior whenever a loop counts upward',
    ],
    correct: [0],
    why: 'Off-by-one errors come from a boundary being slightly wrong, like using "less than or equal" where "less than" was meant.',
    std: 'Code.org AP - debugging logic errors',
  },
  {
    q: 'Conditionals let a program:',
    a: [
      'Take different actions depending on a test',
      'Repeat the same action a set number of times',
      'Give a name to a block of reusable code',
      'Hold information while the program runs',
    ],
    correct: [0],
    why: 'A conditional evaluates something true or false and branches. That is how a program makes a decision.',
    std: 'Code.org AP - conditionals',
  },
  {
    q: 'Which are good debugging habits?',
    a: [
      'Change one thing at a time and retest',
      'Read the error message before editing',
      'Print values to see what the code sees',
      'Rewrite the whole program when stuck',
    ],
    correct: [0, 1, 2],
    why: 'Debugging is investigation: isolate one variable, read what the computer told you, and check your assumptions. Starting over throws away evidence.',
    std: 'Code.org AP - debugging strategies; ISTE 1.5 Computational Thinker',
  },
  {
    q: 'Decomposition means:',
    a: [
      'Breaking a big problem into smaller parts',
      'Removing code that is no longer being used',
      'Turning an algorithm into a finished program',
      'Finding the pattern shared by two problems',
    ],
    correct: [0],
    why: 'Decomposition splits an overwhelming problem into pieces you can solve and test one at a time.',
    std: 'ISTE 1.5b Computational Thinker - decompose problems',
  },
  {
    q: 'Functions help programmers mainly because they:',
    a: [
      'Let one block of code be reused many times',
      'Make a program run on any operating system',
      'Prevent every kind of error from occurring',
      'Store large amounts of data more efficiently',
    ],
    correct: [0],
    why: 'A function is named, reusable logic. Fixing a bug inside it fixes every place that calls it.',
    std: 'Code.org AP - functions and abstraction',
  },
  {
    q: 'In the instruction x = x + 1, what happens?',
    a: [
      'The value in x increases by one',
      'x is compared to x plus one',
      'A new variable named x appears',
      'The program stops with an error',
    ],
    correct: [0],
    why: 'A single equals sign assigns. The right side is calculated using the old value of x, then stored back into x.',
    std: 'Code.org AP - assignment vs. comparison',
  },
  {
    q: 'Order matters in an algorithm because:',
    a: [
      'Steps can depend on results of earlier steps',
      'Computers read instructions in random order',
      'Longer algorithms always run more slowly',
      'Every step must be repeated the same number',
    ],
    correct: [0],
    why: 'Sequence is a core building block. Putting the frosting on before baking gives you a very different cake.',
    std: 'Code.org AP - sequence',
  },
  {
    q: 'Which of these are examples of abstraction?',
    a: [
      'Using a map that hides unnecessary detail',
      'Calling a function without knowing its code',
      'Naming a group of steps with one label',
      'Listing every instruction the CPU will run',
    ],
    correct: [0, 1, 2],
    why: 'Abstraction hides detail so you can think at a higher level. Listing every CPU instruction is the opposite of abstracting.',
    std: 'ISTE 1.5 Computational Thinker - abstraction',
  },
  {
    q: 'A program gives a wrong answer but never crashes. This is:',
    a: [
      'A logic error in how the steps were written',
      'A syntax error that the interpreter has missed',
      'Proof the algorithm itself is impossible',
      'A sign the hardware is beginning to fail',
    ],
    correct: [0],
    why: 'Logic errors run fine and produce the wrong result, which makes them harder to find than syntax errors that stop the program.',
    std: 'Code.org AP - error types',
  },
];

export const QUESTION_POOLS = [DESIGN, SYSTEMS, DATA, CODE];

/**
 * Picks `count` questions for a terminal and shuffles both the question order
 * and the answer order, remapping the correct indices to match.
 */
export function drawQuestions(terminalIndex, count, rng) {
  const pool = QUESTION_POOLS[terminalIndex] || DESIGN;
  const picked = rng.shuffle(pool).slice(0, Math.min(count, pool.length));

  return picked.map((q) => {
    const order = rng.shuffle(q.a.map((_, i) => i));
    const options = order.map((original) => ({
      text: q.a[original],
      correct: q.correct.includes(original),
    }));
    return {
      text: q.q,
      options,
      multi: q.correct.length > 1,
      correctCount: q.correct.length,
      why: q.why,
      std: q.std,
    };
  });
}

/** Total questions available, shown in the README and end-of-run report. */
export const QUESTION_COUNT = QUESTION_POOLS.reduce((n, p) => n + p.length, 0);
