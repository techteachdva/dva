/**
 * The question bank.
 *
 * Four terminals. Content is drawn from Code.org's middle school CS Discoveries
 * strands and the DEFINE-PREPARE-TRY-REFLECT problem solving process, and is
 * tagged primarily against the ITEM 2025 standards (Information and Technology
 * Educators of Minnesota, grade 8 benchmarks), with the ISTE Standards for
 * Students and CSTA codes carried as secondary references where the ITEM
 * document itself cross-references them.
 *
 * Authoring rules, enforced by hand and verified by _lencheck.html:
 *
 *   1. Every option in a question is within a few characters of the others, so
 *      "pick the longest answer" is never a winning strategy.
 *   2. Distractors are real misconceptions, not filler. Several questions have
 *      more than one correct answer and say so.
 *   3. Questions target Apply / Analyze / Evaluate rather than vocabulary
 *      recall. Scenarios, judgment calls, and code tracing beat definitions.
 *
 * Fields:
 *
 *   id      Stable unique identifier. SAVE DATA KEY - never renumber or reuse.
 *           DES- / SYS- / DAT- / COD- prefix per pool.
 *   q       Question text.
 *   a       Four options.
 *   correct Indices into `a`. Length > 1 means multi-select.
 *   why     Explanation shown after answering. This is the teaching moment.
 *   std     Standard reference: "ITEM <code> - <label> | <secondary>".
 *   level   1 approachable, 2 core, 3 challenging. Defaults to 2 if absent.
 *
 * Options are shuffled at runtime, so the order written here does not matter.
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

/** Applied to any question that does not declare its own `level`. */
const DEFAULT_LEVEL = 2;

/* ============================================================================
   TERMINAL 1 - THE DESIGN PROCESS
   ITEM Strand 3 (Technology and Innovation), anchor T3 "Design solutions to
   problems", mainly 8.3.3.1. ISTE 1.4 Innovative Designer.
   ========================================================================== */

const DESIGN = [
  {
    id: 'DES-001',
    q: 'In the DEFINE phase, what is your main job?',
    a: [
      'Pin down who has the problem and what success means',
      'Choose the tools, materials, and time your build needs',
      'Create a working model that users can try out',
      'Decide which version of your design performed best',
    ],
    correct: [0],
    why: 'DEFINE is about understanding the problem and the people who have it. Materials belong to PREPARE, a working model is TRY, and judging versions is REFLECT.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4a Innovative Designer',
    level: 1,
  },
  {
    id: 'DES-002',
    q: 'Which of these belong in the PREPARE phase?',
    a: [
      'Researching how others have solved similar problems',
      'Listing the materials, steps, and time you will need',
      'Watching a user struggle with your first prototype',
      'Brainstorming and sketching several possible designs',
    ],
    correct: [0, 1, 3],
    why: 'PREPARE is research, planning, and generating ideas before you commit. Watching a user handle a prototype only happens once something exists to test, which is TRY.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4b Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-003',
    q: 'Your prototype fails the first test. In this process, that means:',
    a: [
      'You have useful data about what to change next',
      'You defined the problem incorrectly from the start',
      'You should restart the whole project from scratch',
      'The design process was not being followed properly',
    ],
    correct: [0],
    why: 'Failure is information, not a verdict. A failed test tells you which assumption was wrong so the next cycle can be better.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4d Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-004',
    q: 'What makes the design process a cycle instead of a straight line?',
    a: [
      'What you learn in REFLECT sends you back to earlier steps',
      'Every phase must be completely finished before the next begins',
      'The four phases can be completed in any order you like',
      'Teams repeat the TRY phase until the deadline arrives',
    ],
    correct: [0],
    why: 'Reflection feeds the next round. You often return to DEFINE with a sharper problem or to PREPARE with a better plan, which is what makes it iterative.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4c Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-005',
    q: 'A classmate says "I am in TRY, so I cannot change my plan." Best reply?',
    a: [
      'Testing often reveals plan changes worth making now',
      'Correct, plans are locked once building has started',
      'You should wait for REFLECT to change anything at all',
      'Then you defined your problem too broadly to build',
    ],
    correct: [0],
    why: 'The phases are not locked doors. When a test shows the plan is wrong, changing it immediately is the whole point of prototyping.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4c Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-006',
    q: 'Which questions belong in REFLECT?',
    a: [
      'Did our solution meet the needs we wrote down?',
      'What would we change if we built it again?',
      'What materials should we order for the build?',
      'Which parts of our test surprised us the most?',
    ],
    correct: [0, 1, 3],
    why: 'REFLECT compares results against the needs you defined and turns surprises into next steps. Ordering materials is planning, which is PREPARE.',
    std: 'ITEM 8.1.5.2 - Reflecting on work | ISTE 1.1c Empowered Learner',
    level: 2,
  },
  {
    id: 'DES-007',
    q: 'Why do designers define constraints such as budget or size early?',
    a: [
      'Constraints shape what solutions are even possible here',
      'Constraints guarantee the first prototype will work',
      'Constraints replace the need to test with real users',
      'Constraints let teams skip the planning phase safely',
    ],
    correct: [0],
    why: 'A constraint is a boundary on the solution space. Knowing it early stops you from designing something you could never actually build.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4b Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-008',
    q: 'The best way to learn whether your design solves the problem is to:',
    a: [
      'Watch real users try it out and record what happens',
      'Ask your team whether they like the final design',
      'Compare your sketches with the original plan',
      'Check that every material on your list was used',
    ],
    correct: [0],
    why: 'Only the people with the problem can tell you whether it is solved. Your team is too close to the design to judge it fairly.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4a Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-009',
    q: 'Interviewing the people affected by a problem happens mostly in:',
    a: [
      'DEFINE, because their needs frame the problem',
      'PREPARE, because they help you gather materials',
      'TRY, because they have to operate the prototype',
      'REFLECT, because opinions only matter at the end',
    ],
    correct: [0],
    why: 'You cannot define a problem you have not heard described. Users appear again in TRY and REFLECT, but their needs shape DEFINE first.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4a Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-010',
    q: 'Iteration means:',
    a: [
      'Improving a design through repeated cycles of testing',
      'Producing many different products at the very same time',
      'Following the four phases in the correct order once',
      'Dividing the work so each member owns one phase',
    ],
    correct: [0],
    why: 'Each pass through the cycle uses what the last pass taught you. One trip through the phases is not iteration.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4c Innovative Designer',
    level: 1,
  },
  {
    id: 'DES-011',
    q: 'Which are good criteria for judging a design?',
    a: [
      'Measurable, so you can tell if you met them',
      'Written before you start building the thing',
      'Based on the needs of the actual users',
      'Kept vague so any result counts as success',
    ],
    correct: [0, 1, 2],
    why: 'Criteria must be measurable, set in advance, and rooted in user needs. Vague criteria let you declare victory without earning it.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4b Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-012',
    q: 'Documenting your process as you work matters most because:',
    a: [
      'It lets you explain and repeat what you did',
      'It proves that you finished the project on time',
      'It replaces the need for a final prototype',
      'It makes the REFLECT phase optional later',
    ],
    correct: [0],
    why: 'Documentation makes your thinking visible and repeatable, for your team now and for whoever picks the project up next.',
    std: 'ITEM 8.1.5.1 - Sharing findings | ISTE 1.6d Creative Communicator',
    level: 2,
  },
  {
    id: 'DES-013',
    q: 'Team A builds one polished prototype. Team B builds three rough ones. Early on, which is stronger?',
    a: [
      'Team B, since rough tests compare ideas fast',
      'Team A, since a polished build tests it clearly',
      'Team B, since more builds means a better grade',
      'Team A, since judges reward finished work most',
    ],
    correct: [0],
    why: 'Early prototypes buy information, not points. Three rough builds tell you which direction is worth polishing; one polished build only tells you about itself.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4c Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-014',
    q: 'A team writes this DEFINE statement: "Make the best locker organizer." Its biggest weakness is:',
    a: [
      'It gives you no way to tell whether you succeeded',
      'It names a product instead of a materials list',
      'It should be written after the prototype works',
      'It uses too few words to describe the problem',
    ],
    correct: [0],
    why: 'The word "best" is not measurable. A usable DEFINE names the user, the need, and how you will know the need was met.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4a Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-015',
    q: 'Your first test worked perfectly on the very first try. Which responses make sense?',
    a: [
      'Test it again under harder or messier conditions',
      'Check whether your test was too easy to fail',
      'Ask a user outside your team to try it next',
      'Stop testing, since the design is now finished',
    ],
    correct: [0, 1, 2],
    why: 'A test that cannot fail teaches you nothing. Raise the difficulty and hand it to someone who was not in the room when you built it.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4c Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-016',
    q: 'Halfway through TRY your team realizes the real problem differs from what DEFINE says. Best move?',
    a: [
      'Rewrite DEFINE now and adjust the plan to match',
      'Finish this build, then note it all during REFLECT',
      'Keep the old problem so the phases stay in order',
      'Start a brand new project with the better problem',
    ],
    correct: [0],
    why: 'Discovering the real problem is a win, not a setback. Update DEFINE immediately so the rest of the work aims at the right target.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4d Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-017',
    q: 'A design must be cheap, quick to build, and very sturdy, but it cannot be all three. This is:',
    a: [
      'A trade-off among the competing criteria',
      'A failure to define the problem clearly',
      'A mistake in the prototype build steps',
      'A sign the project should be restarted',
    ],
    correct: [0],
    why: 'Real requirements pull against each other. Naming the trade-off lets you choose on purpose instead of discovering the cost late.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4b Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-018',
    q: 'During testing, users keep pressing the wrong button. Your team says users need clearer instructions. A designer would say:',
    a: [
      'The button design is the real problem to solve',
      'The users need more training before testing',
      'The instructions should be printed larger',
      'The test should be run with older students',
    ],
    correct: [0],
    why: 'When many different users make the same mistake, the design is teaching them to make it. Blaming users hides the fix.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4a Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-019',
    q: 'Which questions help you decide whether a prototype is worth building at all?',
    a: [
      'Can we build it with the time we actually have?',
      'Does it test the part we are least sure about?',
      'Will it show us something we do not know yet?',
      'Will it look impressive when we present it?',
    ],
    correct: [0, 1, 2],
    why: 'A prototype is an experiment. Build the cheapest thing that answers your riskiest question; looking impressive is not an answer.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4b Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-020',
    q: 'In PREPARE your team lists twelve ideas and immediately picks the first one. What did they skip?',
    a: [
      'Comparing ideas against the criteria they wrote',
      'Writing down more ideas before choosing one',
      'Getting approval from the teacher before continuing',
      'Ordering the materials the idea will require',
    ],
    correct: [0],
    why: 'Generating ideas is only half of PREPARE. The other half is judging them against your criteria so the choice is reasoned, not first-come.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4b Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-021',
    q: 'REFLECT is most useful when it happens:',
    a: [
      'After every test, not just at the very end',
      'Only once the final product is fully complete',
      'Before any prototype has been built yet',
      'Whenever the team runs out of materials',
    ],
    correct: [0],
    why: 'Every cycle should end in reflection. Waiting until the end means each lesson arrives too late to change anything.',
    std: 'ITEM 8.1.5.2 - Reflecting on work | ISTE 1.4c Innovative Designer',
    level: 1,
  },
  {
    id: 'DES-022',
    q: 'Your teammate idea tested worse than yours. The most useful thing to write down is:',
    a: [
      'Which part failed and under what conditions',
      'That your own idea should be used from now on',
      'That the teammate did not plan carefully',
      'The final score that each idea received',
    ],
    correct: [0],
    why: 'A losing idea still contains information. Recording the exact failure point lets the next version fix a cause instead of guessing.',
    std: 'ITEM 8.1.5.2 - Reflecting on work | ISTE 1.4c Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-023',
    q: 'You have one week and only one shot at the real build. Best use of the first two days?',
    a: [
      'Testing risky parts with cheap mock-ups',
      'Building the final version very carefully',
      'Writing the presentation about the design',
      'Gathering every material you might ever use',
    ],
    correct: [0],
    why: 'When you get one real build, spend early time removing uncertainty. Cheap mock-ups turn unknowns into knowns before the expensive step.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4b Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-024',
    q: 'A group keeps redesigning but never tests anything. Why is that a problem?',
    a: [
      'Untested changes are guesses, not improvements',
      'Redesigning is not part of the real design process',
      'The team will run out of ideas to try later',
      'Testing must always happen before designing',
    ],
    correct: [0],
    why: 'Iteration only helps if each loop includes evidence. Without a test, version four is just a different guess than version one.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4c Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-025',
    q: 'Which comment from a user test is most useful to a designer?',
    a: [
      '"I could never tell which end was the front."',
      '"I think this is a really creative project."',
      '"You should add more colors to the outside."',
      '"It reminds me of something I saw online."',
    ],
    correct: [0],
    why: 'A specific description of confusion points at a fixable cause. Compliments and feature requests do not tell you what went wrong.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4a Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-026',
    q: 'Which of these are constraints rather than criteria?',
    a: [
      'The budget cannot go above twenty dollars',
      'It must fit inside a standard school locker',
      'It must be finished before Friday afternoon',
      'It should be easy for a new user to operate',
    ],
    correct: [0, 1, 2],
    why: 'Constraints are hard limits you cannot cross. Criteria describe how good a solution is, and ease of use is something you meet by degrees.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4b Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-027',
    q: 'A team tests their app with three friends who already know how it works. That evidence is:',
    a: [
      'Weak, because the testers are not new users',
      'Strong, because the testers know the goal',
      'Weak, because three people is far too many',
      'Strong, because those friends give honest answers',
    ],
    correct: [0],
    why: 'People who already know the system cannot show you where a newcomer gets lost. Test with someone seeing it for the first time.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4a Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-028',
    q: 'Sketching several very different ideas before choosing one mainly helps by:',
    a: [
      'Keeping the team from locking onto one idea',
      'Making sure the final drawing looks neater',
      'Proving that the team worked hard on the project',
      'Reducing the number of materials needed',
    ],
    correct: [0],
    why: 'Locking onto the first idea is the most common design failure. Sketching alternatives keeps your options open long enough to spot a better one.',
    std: 'ITEM 8.3.3.1 - Design process | ISTE 1.4a Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-029',
    q: 'Your solution works, but only for the one person you interviewed. Best next step?',
    a: [
      'Interview a few more users and compare needs',
      'Declare the problem solved for that one user',
      'Rebuild it from scratch for a much wider audience',
      'Add features until everyone would want one',
    ],
    correct: [0],
    why: 'One interview defines a problem; several tell you how widely it is shared. Widening the sample beats guessing what everyone wants.',
    std: 'ITEM 8.1.2.3 - Multiple perspectives | ISTE 1.4a Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-030',
    q: 'Writing a failed attempt into your engineering notebook is worth doing because:',
    a: [
      'It stops the team from running the same test again',
      'It shows the teacher how much effort was spent',
      'It replaces the need to write a final report',
      'It shows the failure came from outside the team',
    ],
    correct: [0],
    why: 'Notebooks keep dead ends dead. Without a record, a teammate spends a whole day rediscovering something you already ruled out.',
    std: 'ITEM 8.1.4.2 - Recording sources | ISTE 1.6d Creative Communicator',
    level: 2,
  },
  {
    id: 'DES-031',
    q: 'A design review with another team pays off most when your team does which of these?',
    a: [
      'Explains what it is unsure about, not just wins',
      'Asks reviewers to try the prototype themselves',
      'Writes down criticism without arguing back yet',
      'Presents only the version that worked the best',
    ],
    correct: [0, 1, 2],
    why: 'Reviews are only worth the time if you expose the weak parts. Showing your best version turns feedback into applause.',
    std: 'ITEM 8.3.4.2 - Collaborating with peers | ISTE 1.7c Global Collaborator',
    level: 3,
  },
  {
    id: 'DES-032',
    q: 'Two groups solve the same cafeteria-line problem but reach different solutions. Before picking one, you should:',
    a: [
      'Compare what each group assumed about the users',
      'Choose the design that looks more polished',
      'Merge both ideas without testing either one',
      'Ask the teacher which group was correct',
    ],
    correct: [0],
    why: 'Different solutions often come from different assumptions. Comparing perspectives shows what each design optimized for.',
    std: 'ITEM 8.1.2.3 - Multiple perspectives | ISTE 1.4a Innovative Designer',
    level: 2,
  },
  {
    id: 'DES-033',
    q: 'A survey shows most students want lockers, but interviews reveal the real pain is forgotten gym clothes. This means:',
    a: [
      'The survey missed the deeper need behind the answer',
      'Surveys are always less useful than interviews',
      'Students lied on the survey on purpose',
      'Lockers are still the best solution to build',
    ],
    correct: [0],
    why: 'People often name a surface fix. Another perspective (interviews, observation) can uncover the problem underneath.',
    std: 'ITEM 8.1.2.3 - Multiple perspectives | ISTE 1.4a Innovative Designer',
    level: 3,
  },
  {
    id: 'DES-034',
    q: 'You find a useful diagram on a museum website for your project. Best practice is to:',
    a: [
      'Save the URL, access date, and title in your notes',
      'Copy the image without noting where it came from',
      'Assume museum sites never need to be cited',
      'Rewrite the caption and treat it as your own work',
    ],
    correct: [0],
    why: 'Recording where evidence came from lets you verify it later and credit the source properly.',
    std: 'ITEM 8.1.4.2 - Recording sources | ISTE 1.6d Creative Communicator',
    level: 2,
  },
  {
    id: 'DES-035',
    q: 'Your teammate repeats a test you already proved fails. The notebook entry that would have helped most said:',
    a: [
      'We tried X on Tuesday; it failed because Y',
      'Our project is going fine so far',
      'The teacher wants more pages filled in',
      'We should never test that idea again',
    ],
    correct: [0],
    why: 'Specific records of what was tried and why it failed prevent duplicated work and speed up the next attempt.',
    std: 'ITEM 8.1.4.2 - Recording sources | ISTE 1.6d Creative Communicator',
    level: 2,
  },
  {
    id: 'DES-036',
    q: 'During a peer review, your partner says your instructions are confusing. A productive response is to:',
    a: [
      'Ask which step lost them and revise that part',
      'Explain that they should have read more carefully',
      'Ignore the comment because you understand it',
      'Finish the project alone to avoid more feedback',
    ],
    correct: [0],
    why: 'Collaboration works when criticism becomes a specific fix. Clarifying the confusing step improves the design for everyone.',
    std: 'ITEM 8.3.4.2 - Collaborating with peers | ISTE 1.7c Global Collaborator',
    level: 2,
  },
  {
    id: 'DES-037',
    q: 'Which actions help a team give useful feedback on a prototype?',
    a: [
      'Let each person try it while others watch quietly',
      'Note problems on sticky notes without debating yet',
      'Ask what worked before listing what confused people',
      'Vote on whose idea was smartest before testing',
    ],
    correct: [0, 1, 2],
    why: 'Useful review is observational and specific. Ranking egos or skipping the try-it step turns feedback into guessing.',
    std: 'ITEM 8.3.4.2 - Collaborating with peers | ISTE 1.7c Global Collaborator',
    level: 3,
  },
];

/* ============================================================================
   TERMINAL 2 - COMPUTING SYSTEMS, NETWORKS & THE INTERNET
   ITEM Strand 3 anchors T1 and T2 (8.3.1.x, 8.3.2.1) with CSTA 2-CS-02,
   2-CS-03, and 2-NI-04 as cross-referenced by the ITEM document.
   ========================================================================== */

const SYSTEMS = [
  {
    id: 'SYS-001',
    q: 'Data crossing the internet is split into packets mainly because:',
    a: [
      'Small pieces can take separate routes and be reassembled',
      'Packets keep the message hidden from anyone who watches',
      'Routers can only hold one complete file at a time',
      'Each packet must arrive in the exact order it was sent',
    ],
    correct: [0],
    why: 'Splitting data lets pieces travel whichever route is open and get rebuilt at the other end. Packets are not private on their own, and they can arrive out of order.',
    std: 'ITEM 8.3.2.1 - Protocols | CSTA 2-NI-04',
    level: 2,
  },
  {
    id: 'SYS-002',
    q: 'A protocol is best described as:',
    a: [
      'A set of agreed rules for how devices communicate',
      'A physical cable that connects two computers',
      'A program that speeds up a slow web connection',
      'A number that identifies a device on a local network',
    ],
    correct: [0],
    why: 'Protocols are agreements, not hardware. HTTP, TCP, and IP are rulebooks both sides follow so different devices can understand each other.',
    std: 'ITEM 8.3.2.1 - Protocols | CSTA 2-NI-04',
    level: 1,
  },
  {
    id: 'SYS-003',
    q: 'Which of these are hardware?',
    a: [
      'The touchpad you use to move the cursor',
      'The camera lens above your screen',
      'The browser you open to visit a site',
      'The memory chip that holds running data',
    ],
    correct: [0, 1, 3],
    why: 'Hardware is physical. A browser is software: instructions stored on hardware and executed by the processor.',
    std: 'ITEM 8.3.1.1 - Programs and devices | ISTE 1.1d Empowered Learner',
    level: 1,
  },
  {
    id: 'SYS-004',
    q: 'Your Chromebook will not join the wifi. Best FIRST troubleshooting step?',
    a: [
      'Check whether the other devices can reach the network',
      'Reinstall the operating system from recovery media',
      'Replace the wireless card inside the Chromebook',
      'Email the help desk a full description of it',
    ],
    correct: [0],
    why: 'Good troubleshooting narrows the problem before changing anything. If nothing else can connect either, the fault is the network, not your device.',
    std: 'ITEM 8.3.1.3 - Troubleshooting | CSTA 2-CS-03',
    level: 2,
  },
  {
    id: 'SYS-005',
    q: 'Encryption protects a message by:',
    a: [
      'Scrambling it so only a key can unscramble it',
      'Sending it along a private route no one else uses',
      'Compressing it into a much smaller file size',
      'Deleting it from the server after it arrives',
    ],
    correct: [0],
    why: 'Encryption transforms readable text into ciphertext. Anyone can intercept it, but without the key it is meaningless.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 2,
  },
  {
    id: 'SYS-006',
    q: 'An IP address is used to:',
    a: [
      'Identify where a device is on a network',
      'Store the websites that a person has visited',
      'Encrypt the traffic leaving a computer',
      'Measure how fast a connection is going',
    ],
    correct: [0],
    why: 'An IP address is an address, like a house number for a device, so packets know where to go.',
    std: 'ITEM 8.3.2.1 - Protocols | CSTA 2-NI-04',
    level: 1,
  },
  {
    id: 'SYS-007',
    q: 'If one router between you and a server fails, usually:',
    a: [
      'Packets simply travel another path to the same place',
      'The whole internet becomes unavailable to everyone',
      'Your message is lost and must be typed again',
      'The server assigns your device a new address',
    ],
    correct: [0],
    why: 'The internet is redundant on purpose. Many possible paths mean one broken link reroutes traffic instead of stopping it.',
    std: 'ITEM 8.3.2.1 - Protocols | CSTA 2-NI-04',
    level: 2,
  },
  {
    id: 'SYS-008',
    q: 'Which statements about the internet and the web are true?',
    a: [
      'The internet is the network of connected devices',
      'The web is one service that runs on the internet',
      'The web and the internet are two names for one thing',
      'Email can travel the internet without using the web',
    ],
    correct: [0, 1, 3],
    why: 'The internet is the infrastructure. The web is one thing you can do with it, alongside email, games, and video calls.',
    std: 'ITEM 8.3.1.1 - Programs and devices | CSTA 2-NI-04',
    level: 2,
  },
  {
    id: 'SYS-009',
    q: 'Bandwidth describes:',
    a: [
      'How much data a connection can carry per second',
      'How far a signal can travel before it gets weaker',
      'How many devices a router is able to store',
      'How long a packet waits before it is dropped',
    ],
    correct: [0],
    why: 'Bandwidth is capacity over time. It is why a class of thirty streaming video feels slower than one person doing it.',
    std: 'ITEM 8.3.1.2 - Describing tech problems | CSTA 2-NI-04',
    level: 2,
  },
  {
    id: 'SYS-010',
    q: 'Which pairing of input and output is correct?',
    a: [
      'Microphone is input, speaker is output',
      'Monitor is input, keyboard is output',
      'A printer is input, a scanner is output',
      'A mouse is input, a touchpad is output',
    ],
    correct: [0],
    why: 'Input carries data into the computer, output sends it back out. A mouse and a touchpad are both inputs.',
    std: 'ITEM 8.3.1.1 - Programs and devices | ISTE 1.1d Empowered Learner',
    level: 1,
  },
  {
    id: 'SYS-011',
    q: 'Software differs from hardware because software:',
    a: [
      'Is a set of instructions rather than a physical part',
      'Can only be changed by physically opening the computer',
      'Is stored outside the device on a network drive',
      'Runs without needing any hardware to execute it',
    ],
    correct: [0],
    why: 'Software is instructions. It always needs hardware to run on, but you can change it without touching a screwdriver.',
    std: 'ITEM 8.3.1.1 - Programs and devices | ISTE 1.1d Empowered Learner',
    level: 1,
  },
  {
    id: 'SYS-012',
    q: 'Which are real signs that your connection to a site is secure?',
    a: [
      'The address begins with https rather than http',
      'The browser shows a closed lock in the bar',
      'The page loads faster than it usually does',
      'The site has a professional looking design',
    ],
    correct: [0, 1],
    why: 'HTTPS and the lock indicate the connection is encrypted. Speed and good design say nothing about security, and scam sites often look polished.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 2,
  },
  {
    id: 'SYS-013',
    q: 'A video call freezes, but text chat inside the same app still works. The best explanation is:',
    a: [
      'Video needs far more bandwidth than text',
      'The text part is stored on your own device',
      'Text messages skip the internet completely',
      'Video calls use a totally different IP address',
    ],
    correct: [0],
    why: 'Both features share one connection, but video moves far more data per second. The lighter service is the one that survives a weak link.',
    std: 'ITEM 8.3.1.2 - Describing tech problems | CSTA 2-NI-04',
    level: 2,
  },
  {
    id: 'SYS-014',
    q: 'You report a problem as "the internet is broken." A more useful description would be:',
    a: [
      '"Pages load on my phone but not on my laptop."',
      '"Nothing on this computer is working today."',
      '"The wifi in this room is being slow again."',
      '"Someone needs to come and fix my computer."',
    ],
    correct: [0],
    why: 'Naming what works and what does not narrows the search immediately. "Broken" gives a helper nothing they can act on.',
    std: 'ITEM 8.3.1.2 - Describing tech problems | CSTA 2-CS-03',
    level: 2,
  },
  {
    id: 'SYS-015',
    q: 'Which steps help you tell a connectivity problem apart from a software problem?',
    a: [
      'Try the same site on a second device nearby',
      'Open a different app that also needs the web',
      'Check whether files stored locally still open',
      'Reinstall the operating system right away',
    ],
    correct: [0, 1, 2],
    why: 'Each of those changes exactly one variable, which is what makes the result meaningful. Reinstalling changes everything at once and teaches you nothing.',
    std: 'ITEM 8.3.1.3 - Troubleshooting | CSTA 2-CS-03',
    level: 3,
  },
  {
    id: 'SYS-016',
    q: 'A file arrives complete even though its packets took different routes. That works because:',
    a: [
      'Each packet carries numbering used to reorder',
      'Routers always send packets along one safe path',
      'The sender waits until one full route is open',
      'Packets are sorted alphabetically on arrival',
    ],
    correct: [0],
    why: 'Every packet carries addressing and sequence information, so the receiving device can rebuild the original order no matter how the pieces travelled.',
    std: 'ITEM 8.3.2.1 - Protocols | CSTA 2-NI-04',
    level: 3,
  },
  {
    id: 'SYS-017',
    q: 'Two schools use different brands of router, laptop, and operating system, yet email between them works. Why?',
    a: [
      'They follow the same protocols to send the mail',
      'They bought hardware from the same supplier',
      'Their networks were connected by one cable',
      'Email works without needing any rules at all',
    ],
    correct: [0],
    why: 'A protocol is a shared rulebook. As long as both ends follow it, the brands and operating systems underneath do not have to match.',
    std: 'ITEM 8.3.2.1 - Protocols | CSTA 2-NI-04',
    level: 2,
  },
  {
    id: 'SYS-018',
    q: 'The same site loads instantly at school and slowly at home. The most likely cause is:',
    a: [
      'The two connections have different bandwidth',
      'The website is stored on the school server',
      'Your home device has a much slower processor chip',
      'The school uses a shorter cable to the site',
    ],
    correct: [0],
    why: 'One page over two different connections points at the network, not the page. Processor speed almost never limits page loading.',
    std: 'ITEM 8.3.1.2 - Describing tech problems | CSTA 2-NI-04',
    level: 2,
  },
  {
    id: 'SYS-019',
    q: 'A classmate says "HTTPS means this site is safe to trust." The accurate correction is:',
    a: [
      'It protects the connection, not your trust',
      'It proves the government has checked the site',
      'It stops the site collecting data on you',
      'It shows the site loads faster than http',
    ],
    correct: [0],
    why: 'HTTPS encrypts traffic between you and the server. A scam site can use HTTPS too, so the padlock says nothing about who owns the site.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 3,
  },
  {
    id: 'SYS-020',
    q: 'Which statements about encrypting a message are true?',
    a: [
      'Someone can still intercept the scrambled data',
      'Without a key the scrambled data stays hidden',
      'The size of the file is what gets protected',
      'The same method can protect stored files too',
    ],
    correct: [0, 1, 3],
    why: 'Encryption assumes interception will happen. It hides meaning rather than existence or size, and it works on files at rest as well as in transit.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 3,
  },
  {
    id: 'SYS-021',
    q: 'Your Chromebook warns that storage is almost full. Which check comes first?',
    a: [
      'See which files or apps use the most space',
      'Delete the largest folder you can find',
      'Restart the device so that it clears memory',
      'Ask for an external drive for the files',
    ],
    correct: [0],
    why: 'Measure before you act. Deleting blindly can remove work you need, and restarting clears memory rather than storage.',
    std: 'ITEM 8.3.1.3 - Troubleshooting | CSTA 2-CS-03',
    level: 2,
  },
  {
    id: 'SYS-022',
    q: 'RAM differs from storage mainly because RAM:',
    a: [
      'Holds only what is running right now',
      'Keeps your files after the power is off',
      'Is measured in gigabytes, not in bytes',
      'Is located outside of the computer case',
    ],
    correct: [0],
    why: 'RAM is the working desk and storage is the filing cabinet. Turn the power off and the desk is swept clean.',
    std: 'ITEM 8.3.1.1 - Programs and devices | ISTE 1.1d Empowered Learner',
    level: 1,
  },
  {
    id: 'SYS-023',
    q: 'An app works fine offline, but its sync button always fails. That points to a problem:',
    a: [
      'In the network, not in the app itself',
      'In the app code, not in the network',
      'In the screen driver on your own device',
      'In the amount of storage remaining',
    ],
    correct: [0],
    why: 'The one feature that needs the network is the only one failing. Isolating which feature breaks points straight at the layer to check.',
    std: 'ITEM 8.3.1.3 - Troubleshooting | CSTA 2-CS-03',
    level: 3,
  },
  {
    id: 'SYS-024',
    q: 'Why might a school filter sites at the router instead of on each laptop?',
    a: [
      'One change then covers every device on it',
      'Routers can read the content of every file',
      'Laptops cannot run filtering software at all',
      'It makes the internet connection much faster',
    ],
    correct: [0],
    why: 'Filtering at the shared choke point scales. Configuring hundreds of laptops one at a time is slower and far easier to get wrong.',
    std: 'ITEM 8.3.2.1 - Selecting the right tool | CSTA 2-CS-02',
    level: 3,
  },
  {
    id: 'SYS-025',
    q: 'A file you saved "to the cloud" is actually stored:',
    a: [
      'On a server owned by some company somewhere',
      'In the air between the wireless devices',
      'Only inside your own device memory chip',
      'On every computer that has ever opened it',
    ],
    correct: [0],
    why: 'The cloud is a data center full of ordinary servers. That matters, because whoever owns the server also sets the rules for your file.',
    std: 'ITEM 8.3.1.1 - Programs and devices | ISTE 1.1d Empowered Learner',
    level: 1,
  },
  {
    id: 'SYS-026',
    q: 'A team wants to log classroom temperature every minute for a week. Which parts does that system need?',
    a: [
      'A sensor to take the temperature reading',
      'Storage to keep the readings over time',
      'A program that runs the readings on time',
      'A printer to make the numbers real data',
    ],
    correct: [0, 1, 2],
    why: 'Collecting data needs an input, somewhere to keep it, and a program controlling the timing. Printing changes the format, not whether the data exists.',
    std: 'ITEM 8.3.2.1 - Selecting the right tool | CSTA 2-CS-02',
    level: 3,
  },
  {
    id: 'SYS-027',
    q: 'A friend claims airplane mode makes their phone faster. What is actually happening?',
    a: [
      'Background network tasks have all stopped',
      'The processor is given much more power to use',
      'The phone deletes its cached files each time',
      'The screen now refreshes at a much higher rate',
    ],
    correct: [0],
    why: 'Cutting the radios removes background syncing and notifications. The processor is unchanged; it simply has less work queued up.',
    std: 'ITEM 8.3.1.1 - Programs and devices | ISTE 1.1d Empowered Learner',
    level: 2,
  },
  {
    id: 'SYS-028',
    q: 'Devices are handed an IP address automatically when they join a network. That is useful because:',
    a: [
      'Addresses can be reused as devices come and go',
      'It hides your device from everyone else who is online',
      'It encrypts every packet the device will send',
      'It guarantees your device the fastest route',
    ],
    correct: [0],
    why: 'Automatic assignment lets a network share a limited pool of addresses. It is about addressing, not about privacy or speed.',
    std: 'ITEM 8.3.2.1 - Protocols | CSTA 2-NI-04',
    level: 3,
  },
  {
    id: 'SYS-029',
    q: 'The strongest reason a network keeps more than one path between two points is:',
    a: [
      'Traffic keeps moving when one link fails',
      'Messages arrive in the order they were sent',
      'Each path encrypts the data a second time',
      'Devices can then share a single IP address',
    ],
    correct: [0],
    why: 'Redundancy is the whole design goal. Extra paths buy reliability, not ordering, secrecy, or address sharing.',
    std: 'ITEM 8.3.2.1 - Protocols | CSTA 2-NI-04',
    level: 2,
  },
  {
    id: 'SYS-030',
    q: 'A classmate insists the browser IS the internet. The clearest counterexample is:',
    a: [
      'A game console updating with no browser open',
      'A browser showing a page that will never load',
      'Two browsers displaying the very same page',
      'A browser working after wifi is turned off',
    ],
    correct: [0],
    why: 'Plenty of internet traffic never touches a browser at all. The browser is one program that uses the network, among many.',
    std: 'ITEM 8.3.1.1 - Programs and devices | ISTE 1.1d Empowered Learner',
    level: 3,
  },
  {
    id: 'SYS-031',
    q: 'Your laptop joins the wifi but loads nothing, while your phone on the same wifi works. Best next check?',
    a: [
      'Settings on the laptop, such as its proxy',
      'Whether the router needs to be replaced',
      'Whether the school internet bill is paid',
      'The speed of the processor in the laptop',
    ],
    correct: [0],
    why: 'One device fails while another succeeds on the same network, so the difference has to live on that device rather than the network.',
    std: 'ITEM 8.3.1.3 - Troubleshooting | CSTA 2-CS-03',
    level: 3,
  },
];

/* ============================================================================
   TERMINAL 3 - DATA, AI & DIGITAL CITIZENSHIP
   ITEM Strand 1 anchor IL3 (8.1.3.x, evaluating sources, AI vs human content,
   misinformation) and Strand 2 (8.2.1.x, 8.2.2.x). ISTE 1.2 and 1.3.
   ========================================================================== */

const DATA = [
  {
    id: 'DAT-001',
    q: 'A survey given only to the robotics club is used to claim what the whole school wants. The flaw is:',
    a: [
      'The sample does not represent the whole school',
      'The sample is too large to analyze correctly',
      'Surveys cannot measure student opinions in a class',
      'The data was collected during the wrong season',
    ],
    correct: [0],
    why: 'A sample has to look like the population you want to describe. One club is a biased slice, no matter how many responses it gives.',
    std: 'ITEM 8.1.3.4 - Bias and perspective | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-002',
    q: 'Data becomes information when:',
    a: [
      'It is organized so people can draw meaning from it',
      'It is stored in a database rather than a spreadsheet',
      'It is collected from more than one online source',
      'It is converted into binary code for a computer',
    ],
    correct: [0],
    why: 'Raw numbers are data. Once organized and interpreted so someone can act on it, it becomes information.',
    std: 'ITEM 8.1.4.3 - Organizing information | ISTE 1.3c Knowledge Constructor',
    level: 2,
  },
  {
    id: 'DAT-003',
    q: 'Which help you judge whether a source is trustworthy?',
    a: [
      'Who wrote it and what they might gain',
      'Whether other reliable sources agree',
      'How recently the page was last updated',
      'How high it appears in search results',
    ],
    correct: [0, 1, 2],
    why: 'Author, corroboration, and currency are real signals. Search ranking measures popularity and optimization, not accuracy.',
    std: 'ITEM 8.1.3.2 - Credibility and authority | ISTE 1.3b Knowledge Constructor',
    level: 2,
  },
  {
    id: 'DAT-004',
    q: 'A model trained mostly on photos of one kind of dog will likely:',
    a: [
      'Struggle to recognize breeds it rarely saw',
      'Recognize every single breed with equal accuracy',
      'Refuse to make a prediction when unsure',
      'Retrain itself once it sees a new breed',
    ],
    correct: [0],
    why: 'A model learns the data you feed it. Gaps in the training data become blind spots, which is how bias gets built into AI systems.',
    std: 'ITEM 8.2.1.2 - Impact of technology | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-005',
    q: 'Your digital footprint includes:',
    a: [
      'Posts, searches, and data others share about you',
      'Only the accounts that you have made public online',
      'Only files stored on your personal computer',
      'Only the messages you sent and never deleted',
    ],
    correct: [0],
    why: 'Your footprint is bigger than what you post. Services log activity, and other people tag, quote, and upload things about you too.',
    std: 'ITEM 8.2.1.1 - Digital footprint | ISTE 1.2a Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-006',
    q: 'Which are ethical ways to use an AI writing tool for a school essay?',
    a: [
      'Asking it to explain a concept you found hard',
      'Using it to brainstorm angles you then research',
      'Submitting its paragraphs as your own writing',
      'Checking its claims against reliable sources',
    ],
    correct: [0, 1, 3],
    why: 'Using AI to learn, plan, and verify keeps the thinking yours. Handing in its text as your own is plagiarism, and its claims can be confidently wrong.',
    std: 'ITEM 8.2.2.2 - Crediting sources | ISTE 1.2c Digital Citizen',
    level: 3,
  },
  {
    id: 'DAT-007',
    q: 'A bar chart beats a line graph when you want to:',
    a: [
      'Compare amounts across separate categories',
      'Show a value changing steadily over time',
      'Display how parts add up to one whole',
      'Reveal how two variables relate to each other',
    ],
    correct: [0],
    why: 'Bars compare distinct categories. Lines imply continuity over time, pie charts show parts of a whole, scatter plots show relationships.',
    std: 'ITEM 8.1.5.1 - Sharing findings | ISTE 1.6c Creative Communicator',
    level: 2,
  },
  {
    id: 'DAT-008',
    q: 'A stranger asks for your school login to "fix" your account. This is:',
    a: [
      'Phishing, and you should report it to an adult',
      'Normal, because tech support needs your password',
      'Spam, which is annoying but always harmless',
      'A bug in the login system worth ignoring',
    ],
    correct: [0],
    why: 'Real support never needs your password. Requests like this are phishing, and reporting them protects everyone on the network.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-009',
    q: 'Giving credit to a source you used:',
    a: [
      'Lets readers check the evidence for themselves',
      'Is only required when you copy words exactly',
      'Matters mainly for printed books, not for websites',
      'Can be skipped if the source is a free website',
    ],
    correct: [0],
    why: 'Citation is about traceable evidence, not just avoiding trouble. You credit ideas and data too, on any medium, free or not.',
    std: 'ITEM 8.2.2.2 - Crediting sources | ISTE 1.2c Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-010',
    q: 'Which are reasonable ways to reduce bias when collecting data?',
    a: [
      'Ask a group that mirrors the population',
      'Word each question in a neutral way',
      'Collect enough responses to be meaningful',
      'Remove answers that disagree with your idea',
    ],
    correct: [0, 1, 2],
    why: 'Representative sampling, neutral wording, and adequate sample size all reduce bias. Deleting inconvenient responses is the definition of creating it.',
    std: 'ITEM 8.1.3.4 - Bias and perspective | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-011',
    q: 'Metadata is best described as:',
    a: [
      'Data that describes other data',
      'Data that has been fully encrypted',
      'Data copied from another computer',
      'Data that no longer has any use',
    ],
    correct: [0],
    why: 'A photo is data; the time, location, and device stored alongside it are metadata. Metadata can reveal a surprising amount about you.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-012',
    q: 'The strongest of these passwords is:',
    a: [
      'A long phrase made of unrelated words',
      'Your pet name plus your birth year',
      'A short mix of symbols and digits',
      'The same password on every account',
    ],
    correct: [0],
    why: 'Length beats complexity. A long unrelated phrase is hard to crack and easy to remember, while personal details are easy to guess.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 1,
  },
  {
    id: 'DAT-013',
    q: 'An AI chatbot gives you a confident answer and includes a citation. Before you use it you should:',
    a: [
      'Open the cited source and check it exists',
      'Trust it, since a real citation was included',
      'Ask the chatbot whether it is correct',
      'Reword the prompt and use that answer',
    ],
    correct: [0],
    why: 'Chatbots can invent sources that look completely real. Asking the model to grade itself is not verification; opening the source is.',
    std: 'ITEM 8.1.3.3 - Reliability and accuracy | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-014',
    q: 'Two articles describing the same study reach opposite conclusions. Best first step?',
    a: [
      'Find the original study and read its numbers',
      'Choose the article with the most recent date on it',
      'Average the two conclusions together somehow',
      'Pick the one from the larger news website',
    ],
    correct: [0],
    why: 'Both articles are interpretations written by someone. Going back to the study lets you see what the data actually supports.',
    std: 'ITEM 8.1.3.3 - Reliability and accuracy | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-015',
    q: 'Which clues suggest a photo may have been generated by AI?',
    a: [
      'Hands, text, or jewelry that warp oddly',
      'No other source shows the same event',
      'Lighting that disagrees across the image',
      'The photo has a very high resolution',
    ],
    correct: [0, 1, 2],
    why: 'Generated images tend to fail on fine detail and physical consistency, and a real event leaves more than one trace. High resolution is trivial to fake.',
    std: 'ITEM 8.2.2.4 - Decoding media | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-016',
    q: 'A graph starts its vertical axis at 90 instead of 0, making a tiny change look enormous. This is:',
    a: [
      'A misleading choice of axis scale',
      'A required rule for bar charts',
      'A sign the data was invented',
      'A way to fit more data points',
    ],
    correct: [0],
    why: 'Every number on the chart can be accurate while the picture still lies. Read the axis before you read the shape.',
    std: 'ITEM 8.1.3.3 - Reliability and accuracy | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-017',
    q: 'A website address ends in .org. What does that reliably tell you?',
    a: [
      'Very little about its accuracy',
      'It is a nonprofit site with no bias',
      'It is safer than any other .com site',
      'A librarian has reviewed the page',
    ],
    correct: [0],
    why: 'Anyone can register a .org address. The domain is one weak clue; who wrote the page and what they want from you matters far more.',
    std: 'ITEM 8.1.3.2 - Credibility and authority | ISTE 1.3b Knowledge Constructor',
    level: 2,
  },
  {
    id: 'DAT-018',
    q: 'Fact-checkers use "lateral reading," which means:',
    a: [
      'Leaving the page to check who really published it',
      'Reading the page slowly from top to bottom',
      'Comparing paragraphs inside the same article',
      'Skimming the headings before the body text',
    ],
    correct: [0],
    why: 'Professionals leave a page almost immediately to see what other sources say about it. Staying inside the page only shows you its own story.',
    std: 'ITEM 8.1.3.3 - Reliability and accuracy | ISTE 1.3b Knowledge Constructor',
    level: 2,
  },
  {
    id: 'DAT-019',
    q: 'A flashlight app asks for your contacts, camera, and location. The best response is:',
    a: [
      'Deny them, since a light needs none of that',
      'Allow them, or the app will not run at all',
      'Allow location only, since it is harmless',
      'Install it and then delete the app after use',
    ],
    correct: [0],
    why: 'Permissions should match function. A request far beyond the job is a strong sign that the real product being sold is your data.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 3,
  },
  {
    id: 'DAT-020',
    q: 'Which parts of your digital footprint are created without you choosing them?',
    a: [
      'Photos a friend posts and tags you in',
      'Records of which pages you have visited',
      'Comments other people write about you',
      'The username you picked for an account',
    ],
    correct: [0, 1, 2],
    why: 'Most of your footprint is built by services and other people. The parts you deliberately chose are only the visible edge of it.',
    std: 'ITEM 8.2.1.1 - Digital footprint | ISTE 1.2a Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-021',
    q: 'An email says your account closes in one hour unless you log in through its link. The strongest clue this is phishing:',
    a: [
      'It creates urgency and supplies its own link',
      'It was sent to your school email address',
      'It contains a spelling error in one word',
      'It arrived well outside of normal school hours',
    ],
    correct: [0],
    why: 'Urgency plus a supplied link is the core of the trick. Typos help you spot it, but polished phishing exists; the pressure to click is the real tell.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 3,
  },
  {
    id: 'DAT-022',
    q: 'A recommendation feed keeps showing you one point of view. The most likely reason is:',
    a: [
      'It optimizes for what keeps you watching',
      'It has been edited by a human site moderator',
      'Other viewpoints have all been deleted',
      'It follows a rule set by your school',
    ],
    correct: [0],
    why: 'Feeds are tuned for engagement, not balance. What you clicked yesterday quietly narrows what you are offered today.',
    std: 'ITEM 8.2.1.2 - Impact of technology | ISTE 1.2a Digital Citizen',
    level: 3,
  },
  {
    id: 'DAT-023',
    q: 'You rewrite an AI tool explanation in your own words for a report. You still need to:',
    a: [
      'Credit the tool and check the facts',
      'Nothing at all, since the words are yours',
      'Only credit it if you quote it exactly',
      'Only check the facts, not give credit',
    ],
    correct: [0],
    why: 'Credit covers ideas, not only wording, and a paraphrase of a wrong claim is still a wrong claim in your report.',
    std: 'ITEM 8.2.2.2 - Crediting sources | ISTE 1.2c Digital Citizen',
    level: 3,
  },
  {
    id: 'DAT-024',
    q: 'An image is licensed Creative Commons "BY". You may use it as long as you:',
    a: [
      'Give credit to the person who made it',
      'Pay a small fee to the photo sharing site',
      'Do not change the image in any way',
      'Use it only for a school assignment',
    ],
    correct: [0],
    why: 'The BY condition asks for attribution and nothing else. Other letters in a licence add limits such as no edits or no commercial use.',
    std: 'ITEM 8.2.2.1 - Intellectual property | ISTE 1.2c Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-025',
    q: 'A survey asks "Do you agree that the unfair dress code should change?" The problem is:',
    a: [
      'The wording pushes people toward one answer',
      'The question is far too short to be understood',
      'It should have been asked to far more students',
      'It uses a topic that students care about deeply',
    ],
    correct: [0],
    why: 'Loaded wording manufactures agreement. A neutral version reports what people actually think instead of what you hoped they would say.',
    std: 'ITEM 8.1.3.4 - Bias and perspective | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-026',
    q: 'A hiring AI is trained on ten years of one company past hiring decisions. A likely risk is:',
    a: [
      'It repeats whatever patterns the past held',
      'It refuses to rank any candidate at all',
      'It only works if the data set is small',
      'It becomes much fairer than a human reviewer',
    ],
    correct: [0],
    why: 'A model trained on past decisions inherits their bias and then reports it as a prediction. More of the same data cannot correct that.',
    std: 'ITEM 8.2.1.2 - Impact of technology | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-027',
    q: 'Which statements about building a strong password are accurate?',
    a: [
      'Length matters more than odd symbols',
      'Reusing it elsewhere weakens all of them',
      'A passphrase can be long and memorable',
      'Changing one letter monthly is enough',
    ],
    correct: [0, 1, 2],
    why: 'Length and uniqueness do the real work. Predictable small edits are among the first patterns an attacker will try.',
    std: 'ITEM 8.2.2.3 - Privacy and security | ISTE 1.2d Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-028',
    q: 'A post has been shared two hundred thousand times. What does that tell you about its accuracy?',
    a: [
      'Nothing at all about whether the claim is true',
      'That many people have verified the claim',
      'That it likely came from a real newsroom',
      'That the writer is an expert on the topic',
    ],
    correct: [0],
    why: 'Sharing measures reach, not truth. False stories often spread faster precisely because they are built to provoke a reaction.',
    std: 'ITEM 8.2.2.4 - Decoding media | ISTE 1.3b Knowledge Constructor',
    level: 2,
  },
  {
    id: 'DAT-029',
    q: 'You find a perfect statistic, but the page lists no author, date, or source. Best move?',
    a: [
      'Look for the same figure in a cited source',
      'Use it and note which website you found',
      'Use it, since the number looks quite reasonable',
      'Drop the topic because the data is gone',
    ],
    correct: [0],
    why: 'An uncited number is a rumour with digits attached. Either trace it to something checkable or leave it out of your work.',
    std: 'ITEM 8.1.3.2 - Credibility and authority | ISTE 1.3b Knowledge Constructor',
    level: 2,
  },
  {
    id: 'DAT-030',
    q: 'A survey finds that students who eat breakfast score higher on tests. That result shows:',
    a: [
      'A link between the two things, not a cause',
      'That breakfast causes the higher scores',
      'That the survey must have been biased',
      'That scores cause students to eat more',
    ],
    correct: [0],
    why: 'Correlation is a pattern; cause needs a controlled comparison. Something else, such as sleep or income, may be driving both.',
    std: 'ITEM 8.1.3.3 - Reliability and accuracy | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-031',
    q: 'A classmate is being trolled in a group chat. Which responses are appropriate?',
    a: [
      'Save screenshots before anything is deleted',
      'Report it using the school reporting path',
      'Check privately whether your classmate is ok',
      'Reply to the troll so that they will stop',
    ],
    correct: [0, 1, 2],
    why: 'Evidence, reporting, and quiet support all help. Replying feeds the attention that trolling is usually looking for.',
    std: 'ITEM 8.2.1.3 - Exchanging ideas online | ISTE 1.2b Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-032',
    q: 'Deleting a post you regret:',
    a: [
      'Does not remove copies others saved',
      'Erases it from every server all at once',
      'Removes it from all the search results',
      'Is enough to fully protect your privacy',
    ],
    correct: [0],
    why: 'Screenshots, caches, and archives outlive the original. Deleting helps, but permanence is the safer thing to assume before you post.',
    std: 'ITEM 8.2.1.1 - Digital footprint | ISTE 1.2a Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-033',
    q: 'A study of forty students is reported in a headline as "what teenagers think." The best description is:',
    a: [
      'A small sample being stretched too far',
      'A well designed study of every teenager',
      'An error caused by asking the wrong ages',
      'A result that is useless for any purpose',
    ],
    correct: [0],
    why: 'Forty students can tell you something real about forty students. The flaw is the size of the claim, not the existence of the data.',
    std: 'ITEM 8.1.3.1 - Source relevance | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-034',
    q: 'An AI summary of a news article leaves out the paragraph that contradicts its main point. This shows that:',
    a: [
      'A summary can drop what changes the whole meaning',
      'The article itself must have been unreliable',
      'AI tools cannot read long articles at all',
      'The missing paragraph was not that important',
    ],
    correct: [0],
    why: 'A summary is a set of choices about what to keep. Checking it against the full text is how you catch what quietly went missing.',
    std: 'ITEM 8.1.3.3 - Reliability and accuracy | ISTE 1.3b Knowledge Constructor',
    level: 3,
  },
  {
    id: 'DAT-035',
    q: 'You collected quotes, photos, and survey numbers for a report. Before writing conclusions, you should:',
    a: [
      'Sort evidence by theme so patterns are visible',
      'Paste everything into one long paragraph',
      'Delete data that does not support your guess',
      'Wait until the night before it is due',
    ],
    correct: [0],
    why: 'Organizing evidence by theme reveals relationships. A pile of raw facts is harder to interpret than grouped, labeled information.',
    std: 'ITEM 8.1.4.3 - Organizing information | ISTE 1.3c Knowledge Constructor',
    level: 2,
  },
  {
    id: 'DAT-036',
    q: 'A table with source name, date, and main claim helps you mainly because:',
    a: [
      'You can compare sources without rereading each one',
      'Teachers require tables even when they are not useful',
      'It makes the report look longer and more official',
      'It replaces the need to check if sources agree',
    ],
    correct: [0],
    why: 'Structured notes let you see agreement, conflict, and gaps at a glance instead of hunting through pages of text.',
    std: 'ITEM 8.1.4.3 - Organizing information | ISTE 1.3c Knowledge Constructor',
    level: 2,
  },
  {
    id: 'DAT-037',
    q: 'A classmate downloads a paid song and shares the file in a group chat. The strongest issue is:',
    a: [
      'The creator\'s rights were ignored without permission',
      'The file might contain a computer virus',
      'Streaming would have used less phone storage',
      'The teacher cannot hear the song in the chat',
    ],
    correct: [0],
    why: 'Creative work is protected. Sharing a paid file without rights is different from listening through a licensed service.',
    std: 'ITEM 8.2.2.1 - Intellectual property | ISTE 1.2c Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-038',
    q: 'A logo you found online has "all rights reserved" in the caption. That means:',
    a: [
      'You need permission before reusing it commercially',
      'Anyone may edit and sell it without asking',
      'It is free to use because it is on the internet',
      'Crediting the artist is optional for school only',
    ],
    correct: [0],
    why: '"All rights reserved" signals the tightest control. You still need permission or a license that explicitly allows your use.',
    std: 'ITEM 8.2.2.1 - Intellectual property | ISTE 1.2c Digital Citizen',
    level: 3,
  },
  {
    id: 'DAT-039',
    q: 'Someone posts a mean rumor about a student in a class server. Helpful responses include:',
    a: [
      'Reporting the message through the proper channel',
      'Checking on the student privately if you know them',
      'Saving evidence before it is deleted',
      'Sharing the rumor so more people can defend them',
    ],
    correct: [0, 1, 2],
    why: 'Support, documentation, and reporting protect people. Spreading the rumor widens the harm even if your intent is good.',
    std: 'ITEM 8.2.1.3 - Exchanging ideas online | ISTE 1.2b Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-040',
    q: 'A heated thread keeps growing because every reply adds sarcasm. The most constructive move is:',
    a: [
      'Step away and report it instead of escalating',
      'Type a longer reply proving you are right',
      'Screenshot it and post it somewhere else',
      'Create a new account to argue anonymously',
    ],
    correct: [0],
    why: 'Online arguments rarely cool down with more heat. Reporting and disengaging stops feeding the cycle.',
    std: 'ITEM 8.2.1.3 - Exchanging ideas online | ISTE 1.2b Digital Citizen',
    level: 2,
  },
  {
    id: 'DAT-041',
    q: 'You need data on how students use the library. Which source is most relevant?',
    a: [
      'Checkout records from your own school library',
      'A national bestseller list from ten years ago',
      'A celebrity post about reading habits',
      'A video game review with no library data',
    ],
    correct: [0],
    why: 'Relevance means the source actually speaks to your question. Popular or interesting is not the same as on-topic.',
    std: 'ITEM 8.1.3.1 - Source relevance | ISTE 1.3b Knowledge Constructor',
    level: 1,
  },
  {
    id: 'DAT-042',
    q: 'A website about "healthy schools" is run by a company selling air filters. You should:',
    a: [
      'Note the conflict of interest before trusting its claims',
      'Trust it because it uses scientific-looking charts',
      'Ignore it completely with no further reading',
      'Assume all companies lie about every topic',
    ],
    correct: [0],
    why: 'Who publishes information shapes why it exists. A seller may highlight facts that support their product.',
    std: 'ITEM 8.1.3.1 - Source relevance | ISTE 1.3b Knowledge Constructor',
    level: 2,
  },
  {
    id: 'DAT-043',
    q: 'A video uses dramatic music, fast cuts, and a voice that sounds like a news anchor. These choices mainly:',
    a: [
      'Shape how credible and urgent the message feels',
      'Prove the facts inside the video are accurate',
      'Mean the video was made by a journalist',
      'Show the creator has no opinion on the topic',
    ],
    correct: [0],
    why: 'Production techniques influence emotion and trust. Decode the packaging separately from checking the claims.',
    std: 'ITEM 8.2.2.4 - Decoding media | ISTE 1.3b Knowledge Constructor',
    level: 2,
  },
];

/* ============================================================================
   TERMINAL 4 - ALGORITHMS & PROGRAMMING
   ITEM Strand 3 anchor T3: 8.3.3.2 (computational thinking, debugging) and
   8.3.3.3 (algorithms, sequences, loops, events, conditionals, nested loops),
   which the ITEM document cross-references to CSTA 2-AP-12.
   ========================================================================== */

const CODE = [
  {
    id: 'COD-001',
    q: 'An algorithm is:',
    a: [
      'A clear sequence of steps that will solve a problem',
      'A programming language used to write software',
      'A bug that appears when code runs too fast',
      'A device that carries out a list of instructions',
    ],
    correct: [0],
    why: 'An algorithm is the plan, independent of language. You can write the same algorithm in Python, blocks, or plain English.',
    std: 'ITEM 8.3.3.3 - Algorithms | CSTA 2-AP-12',
    level: 1,
  },
  {
    id: 'COD-002',
    q: 'A loop is most useful when you need to:',
    a: [
      'Repeat a set of steps without rewriting them',
      'Choose between two or more different code paths',
      'Store a value that will change over time',
      'Break a program into reusable named parts',
    ],
    correct: [0],
    why: 'Loops handle repetition. Choosing paths is a conditional, storing values is a variable, and naming reusable steps is a function.',
    std: 'ITEM 8.3.3.3 - Loops | CSTA 2-AP-12',
    level: 1,
  },
  {
    id: 'COD-003',
    q: 'Which statements about variables are true?',
    a: [
      'They hold values that a program can change',
      'They are given names that describe their use',
      'They must be set before they can be read',
      'They can only ever store whole numbers',
    ],
    correct: [0, 1, 2],
    why: 'Variables are named, changeable containers that need a value before you read them. They can hold text, decimals, lists, and more.',
    std: 'ITEM 8.3.3.3 - Variables | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-004',
    q: 'Your loop runs exactly one time too many. This is:',
    a: [
      'An off-by-one error in the loop condition',
      'A syntax error the computer is unable to read',
      'A hardware fault in the processor chip',
      'Normal whenever a loop counts upward',
    ],
    correct: [0],
    why: 'Off-by-one errors come from a boundary being slightly wrong, like using "less than or equal" where "less than" was meant.',
    std: 'ITEM 8.3.3.2 - Debugging | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-005',
    q: 'Conditionals let a program:',
    a: [
      'Take different actions depending on a test',
      'Repeat the same action a set number of times',
      'Give a name to a block of reusable code',
      'Hold information while the program runs',
    ],
    correct: [0],
    why: 'A conditional evaluates something true or false and branches. That is how a program makes a decision.',
    std: 'ITEM 8.3.3.3 - Conditionals | CSTA 2-AP-12',
    level: 1,
  },
  {
    id: 'COD-006',
    q: 'Which are good debugging habits?',
    a: [
      'Change one thing at a time and retest',
      'Read the error message before editing',
      'Print values to see what the code sees',
      'Rewrite the whole program when stuck',
    ],
    correct: [0, 1, 2],
    why: 'Debugging is investigation: isolate one variable, read what the computer told you, and check your assumptions. Starting over throws away evidence.',
    std: 'ITEM 8.3.3.2 - Debugging | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-007',
    q: 'Decomposition means:',
    a: [
      'Breaking a big problem into smaller parts',
      'Removing code that is no longer being used',
      'Turning an algorithm into a finished program',
      'Finding the pattern shared by two problems',
    ],
    correct: [0],
    why: 'Decomposition splits an overwhelming problem into pieces you can solve and test one at a time.',
    std: 'ITEM 8.3.3.2 - Computational thinking | ISTE 1.5c Computational Thinker',
    level: 1,
  },
  {
    id: 'COD-008',
    q: 'Functions help programmers mainly because they:',
    a: [
      'Let one block of code be reused many times over',
      'Make a program run on any operating system',
      'Prevent every kind of error from occurring',
      'Store large amounts of data more efficiently',
    ],
    correct: [0],
    why: 'A function is named, reusable logic. Fixing a bug inside it fixes every place that calls it.',
    std: 'ITEM 8.3.3.3 - Programs | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-009',
    q: 'In the instruction x = x + 1, what happens?',
    a: [
      'The value in x increases by one',
      'x is compared with x plus one',
      'A new variable named x appears',
      'The program stops with a type error',
    ],
    correct: [0],
    why: 'A single equals sign assigns. The right side is calculated using the old value of x, then stored back into x.',
    std: 'ITEM 8.3.3.3 - Variables | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-010',
    q: 'Order matters in an algorithm because:',
    a: [
      'Steps can depend on results of earlier steps',
      'Computers read the instructions in random order',
      'Longer algorithms always run more slowly',
      'Every step must be repeated the same number',
    ],
    correct: [0],
    why: 'Sequence is a core building block. Putting the frosting on before baking gives you a very different cake.',
    std: 'ITEM 8.3.3.3 - Sequences | CSTA 2-AP-12',
    level: 1,
  },
  {
    id: 'COD-011',
    q: 'Which of these are examples of abstraction?',
    a: [
      'Using a map that hides unnecessary detail',
      'Calling a function without knowing its code',
      'Naming a group of steps with one label',
      'Listing every instruction the CPU will run',
    ],
    correct: [0, 1, 2],
    why: 'Abstraction hides detail so you can think at a higher level. Listing every CPU instruction is the opposite of abstracting.',
    std: 'ITEM 8.3.3.2 - Computational thinking | ISTE 1.5c Computational Thinker',
    level: 2,
  },
  {
    id: 'COD-012',
    q: 'A program gives a wrong answer but never crashes. This is:',
    a: [
      'A logic error in how the steps were written',
      'A syntax error that the interpreter has missed',
      'Proof the algorithm itself is impossible',
      'A sign the hardware is beginning to fail',
    ],
    correct: [0],
    why: 'Logic errors run fine and produce the wrong result, which makes them harder to find than syntax errors that stop the program.',
    std: 'ITEM 8.3.3.2 - Debugging | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-013',
    q: 'Trace this: x starts at 3, then "repeat 4 times: x = x * 2" runs. Where does x end?',
    a: [
      'x ends at 48',
      'x ends at 24',
      'x ends at 16',
      'x is unchanged',
    ],
    correct: [0],
    why: 'Doubling four times multiplies by sixteen: 3 becomes 6, then 12, then 24, then 48. Tracing one line at a time beats guessing.',
    std: 'ITEM 8.3.3.3 - Loops | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-014',
    q: 'A loop says "while count < 5". count starts at 0 and nothing inside the loop changes it. What happens?',
    a: [
      'The loop never stops running',
      'The loop runs exactly five times',
      'The loop is skipped completely',
      'The program reports a syntax error',
    ],
    correct: [0],
    why: 'A while loop needs something inside it to push the condition toward false. Nothing changes count, so the test stays true forever.',
    std: 'ITEM 8.3.3.3 - Loops | CSTA 2-AP-12',
    level: 3,
  },
  {
    id: 'COD-015',
    q: 'An outer loop repeats 2 times and an inner loop repeats 5 times. The inner body runs:',
    a: [
      'Ten times in total',
      'Seven times in total',
      'Five times in total',
      'Two times in total',
    ],
    correct: [0],
    why: 'Nested loops multiply rather than add. For each of the two outer passes, the inner loop completes all five of its own passes.',
    std: 'ITEM 8.3.3.3 - Nested loops | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-016',
    q: 'Code reads: if score > 10 print "win", else if score > 5 print "close", else print "again". With score = 12:',
    a: [
      'It prints win, then stops there',
      'It prints win and then close',
      'It prints close because 12 > 5',
      'It prints again as the default',
    ],
    correct: [0],
    why: 'An else-if chain stops at the first branch that is true. Once "win" matches, the later tests are never even evaluated.',
    std: 'ITEM 8.3.3.3 - Conditionals | CSTA 2-AP-12',
    level: 3,
  },
  {
    id: 'COD-017',
    q: 'Your program should print the numbers 1 through 10 but prints 1 through 9. Most likely cause?',
    a: [
      'The loop boundary is set one too small',
      'The variable was never initialized',
      'The print command is inside an if',
      'The computer rounds the last number',
    ],
    correct: [0],
    why: 'Off-by-one errors live at boundaries. Check whether the condition should be "less than" or "less than or equal".',
    std: 'ITEM 8.3.3.2 - Debugging | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-018',
    q: 'Which changes would let one function draw squares of any size?',
    a: [
      'Add a size parameter to the function',
      'Use that parameter for each side length',
      'Call it with a different number each time',
      'Copy the function once per square size',
    ],
    correct: [0, 1, 2],
    why: 'Parameters are how one piece of code serves many cases. Copying it per size is exactly the duplication that functions exist to remove.',
    std: 'ITEM 8.3.3.3 - Programs | CSTA 2-AP-12',
    level: 3,
  },
  {
    id: 'COD-019',
    q: 'Code runs: a = 5, then b = a, then a = 9. What is in b?',
    a: [
      'b is 5, the copied value',
      'b is 9, because b tracks a',
      'b is 14, the sum of the two',
      'b is empty until it is used',
    ],
    correct: [0],
    why: 'Assignment copies the value at that moment. Changing a afterwards does not reach back and change b.',
    std: 'ITEM 8.3.3.3 - Variables | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-020',
    q: 'Two students write very different code and both produce the correct output. This means:',
    a: [
      'Both algorithms solve the problem',
      'One of them must have copied it',
      'The shorter one is always the better',
      'Only one can be counted correct',
    ],
    correct: [0],
    why: 'Many algorithms can solve one problem. Which is better depends on readability, speed, and how each handles unusual input.',
    std: 'ITEM 8.3.3.2 - Computational thinking | ISTE 1.5c Computational Thinker',
    level: 2,
  },
  {
    id: 'COD-021',
    q: 'Your sprite should stop at the wall but passes straight through. Best first debugging step?',
    a: [
      'Print the position value each step',
      'Rewrite all the movement code cleanly',
      'Slow the whole program right down first',
      'Add a second wall right behind the first',
    ],
    correct: [0],
    why: 'You need to see what the program sees. Printing the value shows whether the check is wrong or is never being reached at all.',
    std: 'ITEM 8.3.3.2 - Debugging | CSTA 2-AP-12',
    level: 3,
  },
  {
    id: 'COD-022',
    q: 'Which statements about testing a program are true?',
    a: [
      'Edge cases catch what normal input misses',
      'Passing one test does not prove it works',
      'Testing should happen while you build it',
      'A program that runs is one that works',
    ],
    correct: [0, 1, 2],
    why: 'Running and working are different things. Test early, test the edges, and treat one success as a single data point.',
    std: 'ITEM 8.3.3.2 - Computational thinking | CSTA 2-AP-12',
    level: 3,
  },
  {
    id: 'COD-023',
    q: 'You want code to react the moment a key is pressed. The right construct is:',
    a: [
      'An event handler for that one key',
      'A loop that counts key presses',
      'A variable that stores the key',
      'A function that names the key',
    ],
    correct: [0],
    why: 'Events let code wait for something to happen instead of checking constantly. The handler runs when the key press fires.',
    std: 'ITEM 8.3.3.3 - Events | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-024',
    q: 'The test "if temp > 30 and humidity > 80" fires only when:',
    a: [
      'Both conditions are true at once',
      'At least one condition is true here',
      'Neither condition is false yet',
      'The first condition is checked',
    ],
    correct: [0],
    why: 'The word "and" requires every part to hold. Swapping it for "or" would fire on a hot dry day as well.',
    std: 'ITEM 8.3.3.3 - Conditionals | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-025',
    q: 'Splitting a game into "move player", "check collision", and "update score" is an example of:',
    a: [
      'Decomposition into smaller parts',
      'Abstraction of the game logic details',
      'Iteration over all the game objects',
      'Debugging the finished game program',
    ],
    correct: [0],
    why: 'Decomposition splits the whole into parts you can build and test alone. Abstraction is hiding the detail behind a name.',
    std: 'ITEM 8.3.3.2 - Computational thinking | ISTE 1.5c Computational Thinker',
    level: 2,
  },
  {
    id: 'COD-026',
    q: 'A program crashes only when a user types a letter where a number belongs. The real fix is to:',
    a: [
      'Check the input before you use it',
      'Tell users to type numbers only',
      'Remove the part that reads input',
      'Restart the program on a crash',
    ],
    correct: [0],
    why: 'You cannot control what a user types, so validate it. Instructions get ignored, but a check runs every single time.',
    std: 'ITEM 8.3.3.2 - Debugging | CSTA 2-AP-12',
    level: 3,
  },
  {
    id: 'COD-027',
    q: 'The clearest reason to rename a variable from x to scoreTotal is:',
    a: [
      'Future readers can follow the real logic',
      'The program will then run much faster',
      'Long names use up less memory space',
      'It prevents bugs from ever appearing',
    ],
    correct: [0],
    why: 'Names are documentation the computer ignores and humans depend on. Speed and memory use are unaffected either way.',
    std: 'ITEM 8.3.3.3 - Variables | CSTA 2-AP-12',
    level: 1,
  },
  {
    id: 'COD-028',
    q: 'Program A checks 1000 sorted names one by one. Program B splits the list in half repeatedly. B wins because:',
    a: [
      'It rules out half the list each step',
      'It uses far fewer variables in total',
      'It works on unsorted lists as well',
      'It always finds the very first name first',
    ],
    correct: [0],
    why: 'Halving the search space turns a thousand checks into about ten. It only works because the list is already in order.',
    std: 'ITEM 8.3.3.2 - Computational thinking | ISTE 1.5c Computational Thinker',
    level: 3,
  },
  {
    id: 'COD-029',
    q: 'A partner says "just delete it all and start over" after one bug. A stronger reply is:',
    a: [
      'Let us find which line changed the result',
      'Agreed, a fresh start is usually much faster',
      'Let us add more features and retest it',
      'Let us ask another group for their code',
    ],
    correct: [0],
    why: 'Rewriting discards everything already working and usually reintroduces the same bug. Locate the failing line first.',
    std: 'ITEM 8.3.3.2 - Debugging | CSTA 2-AP-12',
    level: 2,
  },
  {
    id: 'COD-030',
    q: 'Which of these describe good use of comments in code?',
    a: [
      'Explain why a tricky choice was made',
      'Warn about input that breaks things',
      'Label sections of a long program',
      'Repeat in words what each line does',
    ],
    correct: [0, 1, 2],
    why: 'Comments should carry what the code cannot say for itself. Narrating every line adds noise and goes stale the moment the code changes.',
    std: 'ITEM 8.3.3.2 - Computational thinking | ISTE 1.6c Creative Communicator',
    level: 2,
  },
  {
    id: 'COD-031',
    q: 'The strongest reason to write your algorithm in plain words before coding is:',
    a: [
      'Logic errors show up before syntax does',
      'Plain words run faster than real code',
      'Teachers always require a written plan first',
      'It removes the need to test the code',
    ],
    correct: [0],
    why: 'Planning on paper separates "what should happen" from "how do I type it". Most hard bugs are decided before any code exists.',
    std: 'ITEM 8.3.3.2 - Computational thinking | ISTE 1.5c Computational Thinker',
    level: 2,
  },
  {
    id: 'COD-032',
    q: 'A loop draws shapes correctly but the pen stays down between them, leaving stray lines. The bug is in:',
    a: [
      'The order of steps inside the loop',
      'The number of times that the loop runs',
      'The name that is given to the loop counter',
      'The speed at which the pen is moving',
    ],
    correct: [0],
    why: 'Every instruction is present but sequenced wrongly. Sequence bugs produce output that is close to right and visibly off.',
    std: 'ITEM 8.3.3.3 - Sequences | CSTA 2-AP-12',
    level: 3,
  },
];

export const QUESTION_POOLS = [DESIGN, SYSTEMS, DATA, CODE];

/** Every authored question, in pool order. Used by the Study Guide. */
export const ALL_QUESTIONS = QUESTION_POOLS.flat();

const BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

/** Look up the raw authored question behind a saved id, or null if it is gone. */
export function getQuestionById(id) {
  return BY_ID.get(id) || null;
}

/** Normalizes a Set, array, or any iterable of ids into an array. */
function toIdList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value[Symbol.iterator] === 'function') return [...value];
  return [];
}

const levelOf = (q) => q.level || DEFAULT_LEVEL;

/** Shuffles one question's answers and remaps which of them are correct. */
function present(q, rng) {
  const order = rng.shuffle(q.a.map((_, i) => i));
  const options = order.map((original) => ({
    text: q.a[original],
    correct: q.correct.includes(original),
  }));
  return {
    id: q.id,
    text: q.q,
    options,
    multi: q.correct.length > 1,
    correctCount: q.correct.length,
    why: q.why,
    std: q.std,
    standard: q.std,
    level: levelOf(q),
  };
}

/**
 * Picks `count` questions for a terminal and shuffles both the question order
 * and the answer order, remapping the correct indices to match.
 *
 * @param {number} terminalIndex  which pool to draw from
 * @param {number} count          how many questions to return
 * @param {object} rng            seeded rng from util.js (needs .shuffle)
 * @param {object} [options]
 * @param {Set<string>|string[]} [options.excludeIds]  ids the player has already
 *   seen. Unseen questions are always preferred. If the pool runs out of unseen
 *   questions the remainder is filled with seen ones, so this never returns
 *   fewer than `count` as long as the pool holds at least that many. When
 *   `excludeIds` is an array it is read as oldest-first, and the least recently
 *   seen questions are reused first.
 * @param {number[]} [options.preferLevels]  optional difficulty weighting, e.g.
 *   [2, 3] to draw harder questions first and fall back to the rest. Omit for
 *   the default behaviour, which ignores `level` entirely.
 * @returns {Array} question objects ready for the Quiz screen
 */
export function drawQuestions(terminalIndex, count, rng, options = {}) {
  const pool = QUESTION_POOLS[terminalIndex] || DESIGN;
  const want = Math.max(0, Math.min(count, pool.length));
  if (!want) return [];

  // Position in excludeIds doubles as a recency hint when it arrives as an array.
  const seenAt = new Map();
  toIdList(options.excludeIds).forEach((id, i) => {
    if (!seenAt.has(id)) seenAt.set(id, i);
  });

  const unseen = [];
  const seen = [];
  for (const q of pool) (seenAt.has(q.id) ? seen : unseen).push(q);

  let candidates = rng.shuffle(unseen);
  const prefer = options.preferLevels;
  if (Array.isArray(prefer) && prefer.length) {
    const wanted = (q) => prefer.includes(levelOf(q));
    candidates = [...candidates.filter(wanted), ...candidates.filter((q) => !wanted(q))];
  }

  const picked = candidates.slice(0, want);

  if (picked.length < want) {
    let refill = rng.shuffle(seen);
    // An ordered exclude list tells us which questions are stalest; a Set does
    // not, so in that case the shuffle above is the whole selection.
    if (Array.isArray(options.excludeIds)) {
      refill = refill.slice().sort((a, b) => seenAt.get(a.id) - seenAt.get(b.id));
    }
    picked.push(...refill.slice(0, want - picked.length));
  }

  return rng.shuffle(picked).map((q) => present(q, rng));
}

/** Total questions available, shown in the README and end-of-run report. */
export const QUESTION_COUNT = ALL_QUESTIONS.length;
