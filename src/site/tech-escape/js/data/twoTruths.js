/**
 * Two Truths and a Lie — Social Emotional Learning & Digital Citizenship.
 *
 * Middle-school scenarios drawn from group chats, gaming, and social media.
 * Each item has exactly two true statements and one plausible misconception.
 *
 * Fields:
 *
 *   id          Stable unique identifier. SAVE DATA KEY — never renumber or reuse.
 *               SEL-001 through SEL-050.
 *   topic       'Digital Citizenship' or 'Social Emotional Learning'.
 *   sender      Group-chat style display name with emoji.
 *   preview     One-sentence hook that sets the scene.
 *   statements  Exactly three short statements; two truths, one lie.
 *   lieIndex    Index (0|1|2) of the false statement.
 *   why         Pedagogical explanation of why the lie is wrong and what to do.
 */

export const SEL_TOPIC = {
  name: 'SEL LOUNGE — TWO TRUTHS',
  topic: 'Social Emotional Learning & Digital Citizenship',
  blurb: 'Spot the lie. Choose wisely.',
};

const TWO_TRUTHS_DATA = [
  {
    id: 'SEL-001',
    topic: 'Digital Citizenship',
    sender: 'Jordan 📱',
    preview: 'Someone posted a screenshot of our private group chat in the school story 😬',
    statements: [
      'Screenshots can spread even when you thought a chat was private.',
      'Deleting the original message always removes every copy people saved.',
      'If you share a screenshot without asking, you can hurt trust and break school rules.',
    ],
    lieIndex: 1,
    why: 'Deleting a message only removes it from the chat app — not from screenshots, forwards, or saved photos. Before you share anything from a private chat, ask the people involved or leave it out. If something already leaked, tell a trusted adult instead of reposting it.',
  },
  {
    id: 'SEL-002',
    topic: 'Social Emotional Learning',
    sender: 'Maya 💬',
    preview: 'They kicked me from the Minecraft server and said it was "just a joke"',
    statements: [
      'Being left out on purpose can feel as bad as in-person exclusion.',
      'A joke stops being funny when the person on the receiving end says it hurts.',
      'If you ignore exclusion online, it usually fixes itself without anyone saying anything.',
    ],
    lieIndex: 2,
    why: 'Online exclusion rarely resolves on its own — silence often lets it continue. If you are excluded, it is okay to step away, talk to someone you trust, or ask a moderator for help. If you see it happening, checking in with the person left out is a small act that matters.',
  },
  {
    id: 'SEL-003',
    topic: 'Digital Citizenship',
    sender: 'Devon 🎮',
    preview: 'Someone in voice chat keeps saying slurs "because it is just the game"',
    statements: [
      'Voice chat rules are different from school, so anything goes there.',
      'Hate speech in a game lobby can still get you reported or banned.',
      'Muting or leaving a toxic voice channel protects your mood and focus.',
    ],
    lieIndex: 0,
    why: 'Game platforms have community standards, and hate speech can lead to bans or reports to school when it involves classmates. Muting, leaving, or reporting protects you. If it involves someone from school, save evidence and tell a trusted adult — "it is just a game" is not a free pass to harm others.',
  },
  {
    id: 'SEL-004',
    topic: 'Social Emotional Learning',
    sender: 'Aisha ✨',
    preview: 'My friend posted a mean meme about someone in our grade',
    statements: [
      'Laughing at a mean post can encourage more bullying.',
      'Sharing a bullying post to "warn people" always helps the victim.',
      'You can be an upstander by not engaging and supporting the person targeted.',
    ],
    lieIndex: 1,
    why: 'Reposting bullying content spreads it further and can embarrass the victim again. Upstanders refuse to pass it along, report it on the platform, and check in privately with the person hurt. Warning others is better done by telling an adult who can handle it safely.',
  },
  {
    id: 'SEL-005',
    topic: 'Digital Citizenship',
    sender: 'Chris 🔐',
    preview: 'My best friend asked for my Instagram password "just for one day"',
    statements: [
      'Sharing passwords gives someone full control of your account and DMs.',
      'A real friend will understand if you say no to sharing login info.',
      'Sharing passwords with one close friend is safe if you trust them completely.',
    ],
    lieIndex: 2,
    why: 'Even trusted friends can accidentally post, get hacked, or feel pressured to share what they see. Passwords are personal — use strong unique ones and never trade them. If someone pushes back when you say no, that is useful information about the friendship.',
  },
  {
    id: 'SEL-006',
    topic: 'Social Emotional Learning',
    sender: 'Riley 🌈',
    preview: 'There is drama in the group chat and I do not want to pick sides',
    statements: [
      'Staying neutral online means you should never tell an adult about serious conflict.',
      'You can care about friends without joining every argument.',
      'Taking a pause before replying can stop a fight from growing.',
    ],
    lieIndex: 0,
    why: 'Neutral does not mean silent about harm. You can avoid picking sides while still reporting threats, harassment, or anything that feels unsafe. Pausing, using "I" statements, and moving heated talks offline or to a mediator are healthy ways to stay out of drama without ignoring real problems.',
  },
  {
    id: 'SEL-007',
    topic: 'Digital Citizenship',
    sender: 'Sam 📸',
    preview: 'Someone took a photo of me at lunch and wants to post it',
    statements: [
      'You have the right to say no to a photo being posted, even in public.',
      'If you are in the background of a photo, you legally cannot ask for it to be taken down.',
      'Once a photo is online, you cannot fully control who sees or saves it.',
    ],
    lieIndex: 1,
    why: 'You can always ask friends not to post you, and many schools treat non-consensual posting as a digital citizenship issue. If someone ignores your no, talk to a trusted adult. Being in the background does not erase your right to privacy and respect.',
  },
  {
    id: 'SEL-008',
    topic: 'Social Emotional Learning',
    sender: 'Taylor 🎧',
    preview: 'I stayed up until 2 a.m. gaming and my mom took my console',
    statements: [
      'Losing sleep can make mood, grades, and friendships harder the next day.',
      'Talking about screen limits calmly works better than hiding your usage.',
      'Parents who set screen-time rules never understand gaming or social life.',
    ],
    lieIndex: 2,
    why: 'Many parents set limits because they care about sleep and balance, not because they "do not get it." Hiding usage usually breaks trust. Try proposing a schedule, using built-in timers, or agreeing on a check-in — negotiation beats sneaking every time.',
  },
  {
    id: 'SEL-009',
    topic: 'Digital Citizenship',
    sender: 'Priya 🔍',
    preview: 'There is a rumor on TikTok about someone in our school',
    statements: [
      'If a rumor has lots of views, it is probably accurate.',
      'Rumors online can reach people faster than hallway gossip.',
      'Checking whether a claim is true before sharing protects everyone involved.',
    ],
    lieIndex: 0,
    why: 'Views measure attention, not truth. False rumors can ruin reputations in hours. Pause before reposting, look for reliable sources, and avoid naming people in speculation. If something is harmful or threatening, report it and tell a trusted adult.',
  },
  {
    id: 'SEL-010',
    topic: 'Social Emotional Learning',
    sender: 'Marcus 🤝',
    preview: 'I saw someone getting piled on in the comments and did not know what to do',
    statements: [
      'A single supportive comment can help a target feel less alone.',
      'Comment-section pile-ons are harmless because nobody knows the person in real life.',
      'Reporting abusive comments is different from starting more drama.',
    ],
    lieIndex: 1,
    why: 'Online harassment hurts even when it is "just comments," and classmates often recognize each other. Reporting, blocking, or a kind DM to the person targeted are upstander moves. Joining the pile-on adds harm — you do not need a perfect speech to make a difference.',
  },
  {
    id: 'SEL-011',
    topic: 'Digital Citizenship',
    sender: 'Elena 📱',
    preview: 'An anonymous app at school has people posting secrets about classmates',
    statements: [
      'Anonymous does not mean untraceable — platforms and schools can investigate serious posts.',
      'Mean anonymous posts can still count as bullying or harassment.',
      'Anonymous apps guarantee that nobody can ever find out who posted.',
    ],
    lieIndex: 2,
    why: 'Anonymous apps often cooperate with schools or law enforcement when safety is at risk, and metadata can sometimes identify users. Treat anonymous spaces like public ones: do not post secrets about others, and report threats. If you are targeted, save screenshots and tell an adult.',
  },
  {
    id: 'SEL-012',
    topic: 'Social Emotional Learning',
    sender: 'Noah 😤',
    preview: 'I typed something mean when I was mad and now the whole chat saw it',
    statements: [
      'Once you apologize in chat, everyone has to forgive you immediately.',
      'Anger can make us write things we would not say face to face.',
      'A sincere apology and giving space can start to repair trust.',
    ],
    lieIndex: 0,
    why: 'Apologies matter, but healing takes time and the other person chooses when they are ready. Follow up with changed behavior, not repeated demands for forgiveness. If you are upset, draft offline, wait ten minutes, or talk in person before sending.',
  },
  {
    id: 'SEL-013',
    topic: 'Digital Citizenship',
    sender: 'Zoe 🌍',
    preview: 'My teacher said our digital footprint follows us — is that real?',
    statements: [
      'Old posts and usernames can show up in searches years later.',
      'Kids\' online posts disappear automatically when they turn eighteen.',
      'Thinking before you post helps protect future opportunities.',
    ],
    lieIndex: 1,
    why: 'The internet rarely forgets on its own. Posts, tags, and comments can be screenshotted or archived. You can clean up accounts, adjust privacy settings, and post thoughtfully going forward — but assume what you share could be seen by colleges, employers, or future you.',
  },
  {
    id: 'SEL-014',
    topic: 'Social Emotional Learning',
    sender: 'Jayden 💭',
    preview: 'My friend has not replied in three days and I think they are mad at me',
    statements: [
      'Delayed replies can mean someone is busy, overwhelmed, or offline.',
      'Asking gently if everything is okay is better than sending ten messages.',
      'If someone does not reply instantly, they are definitely ending the friendship.',
    ],
    lieIndex: 2,
    why: 'Silence has many explanations — sports, family stuff, phone limits, or needing space. Assumptions often create conflict that was not there. One calm check-in is fine; flooding someone with messages usually adds pressure. If patterns worry you, talk to a trusted adult.',
  },
  {
    id: 'SEL-015',
    topic: 'Digital Citizenship',
    sender: 'Fatima 🛡️',
    preview: 'Someone in Discord DMed me a link to "free Robux"',
    statements: [
      'Too-good-to-be-true offers often steal accounts or install malware.',
      'If a link comes from a friend\'s account, it is always safe to click.',
      'Reporting and blocking suspicious DMs protects you and others.',
    ],
    lieIndex: 1,
    why: 'Accounts get hacked and impersonate friends all the time. Verify through another channel before clicking. Never enter your password on unofficial sites. Use official app stores, enable two-factor authentication, and tell an adult if you already clicked something suspicious.',
  },
  {
    id: 'SEL-016',
    topic: 'Social Emotional Learning',
    sender: 'Leo 🎯',
    preview: 'Two friends want me to join a group call to "confront" someone',
    statements: [
      'More people on a call always makes conflict resolution fairer.',
      'Group confrontations online can escalate fast and leave lasting hurt.',
      'Suggesting a calm one-on-one talk or involving a mediator is safer.',
    ],
    lieIndex: 0,
    why: 'Piling on someone in a group call often feels like ambush, not fairness. Conflict de-escalation works best with clear goals, privacy, and respect. You can decline to join, propose talking to a counselor, or message the person privately if it feels safe.',
  },
  {
    id: 'SEL-017',
    topic: 'Digital Citizenship',
    sender: 'Hannah 📵',
    preview: 'My cousin wants to borrow my phone to "just check something real quick"',
    statements: [
      'Unlocked phones can expose private messages, photos, and saved passwords.',
      'It is okay to say no or to supervise what someone does on your device.',
      'Letting anyone use your logged-in phone has zero privacy risks.',
    ],
    lieIndex: 2,
    why: 'A logged-in phone is access to your whole digital life — DMs, banking apps, location, and accounts. Offer to look something up for them instead, or log out of sensitive apps first. Boundaries around devices are normal and smart.',
  },
  {
    id: 'SEL-018',
    topic: 'Social Emotional Learning',
    sender: 'Omar 🌟',
    preview: 'I laughed at a meme that made fun of someone\'s appearance',
    statements: [
      'Online jokes about appearance do not affect people because they are "not real."',
      'Humor that targets how someone looks can damage self-esteem.',
      'You can tell friends you are not comfortable with that kind of joke.',
    ],
    lieIndex: 0,
    why: 'Targets often see those posts, and laughter signals approval to everyone watching. You can un-like, speak up, or change the subject. Kindness online means remembering a real person is on the other side of the screen.',
  },
  {
    id: 'SEL-019',
    topic: 'Digital Citizenship',
    sender: 'Grace 🔔',
    preview: 'Should I report something mean I saw, or is that snitching?',
    statements: [
      'Reporting threats or repeated harassment helps keep communities safer.',
      'Reporting always gets the reporter in trouble with their friends.',
      'Gossiping about what someone did is different from telling a trusted adult.',
    ],
    lieIndex: 1,
    why: 'Reporting serious harm is responsible, not snitching — gossip spreads rumors for entertainment. Platforms and schools use reports to stop bullying and threats. You can report anonymously on many apps. Real friends do not pressure you to stay silent about safety.',
  },
  {
    id: 'SEL-020',
    topic: 'Social Emotional Learning',
    sender: 'Kai 🧘',
    preview: 'I got into a heated debate in comments and my heart is racing',
    statements: [
      'Strong emotions can narrow your thinking and make replies harsher.',
      'Stepping away from the screen helps your body calm down.',
      'Winning an online argument is more important than staying respectful.',
    ],
    lieIndex: 2,
    why: 'No comment section trophy is worth damaging relationships or your reputation. When you feel activated, close the app, drink water, or move around. Return later if you still want to discuss — or agree to disagree. Respect outlasts "winning."',
  },
  {
    id: 'SEL-021',
    topic: 'Digital Citizenship',
    sender: 'Isabella 📲',
    preview: 'A classmate made a fake account pretending to be me',
    statements: [
      'Fake accounts are harmless if they only post silly jokes.',
      'Impersonation can violate platform rules and school policies.',
      'Saving evidence and reporting the account is a smart first step.',
    ],
    lieIndex: 0,
    why: 'Impersonation can spread false information, embarrass you, or harm your reputation — even as a "joke." Report the profile, tell a trusted adult, and warn close friends it is not you. Schools take identity impersonation seriously when it affects students.',
  },
  {
    id: 'SEL-022',
    topic: 'Social Emotional Learning',
    sender: 'Tyler 🏀',
    preview: 'My team group chat turned toxic after we lost a game',
    statements: [
      'Blaming one player publicly can hurt the whole team\'s trust.',
      'Venting anger at teammates in chat always makes teams play better.',
      'Private feedback or a reset message can refocus the group.',
    ],
    lieIndex: 1,
    why: 'Public blame creates fear and resentment, not better performance. If you are upset, cool off first. Constructive talk works one-on-one or after everyone calms down. If chat stays toxic, mute notifications and loop in a coach or adult.',
  },
  {
    id: 'SEL-023',
    topic: 'Digital Citizenship',
    sender: 'Nina 🎬',
    preview: 'Someone wants to livestream our hangout without asking everyone',
    statements: [
      'Livestreams can show faces, locations, and conversations to strangers.',
      'Everyone present should agree before going live or recording.',
      'If you are in the room, you automatically consent to being streamed.',
    ],
    lieIndex: 2,
    why: 'Consent matters for recordings and livestreams — people may have privacy, safety, or family reasons to opt out. Ask the group out loud, not just in chat. If someone streams anyway, leave the frame and tell an adult if you feel unsafe.',
  },
  {
    id: 'SEL-024',
    topic: 'Social Emotional Learning',
    sender: 'Ben 🐢',
    preview: 'I sent a text and they left me on read — should I spam them?',
    statements: [
      'Being left on read always means the other person hates you.',
      'Repeated messages can feel overwhelming or pushy.',
      'Giving space shows respect for the other person\'s timing.',
    ],
    lieIndex: 0,
    why: 'Read receipts show delivery, not feelings. People pause replies for many reasons. One follow-up after a day is reasonable; a burst of messages rarely helps. If communication patterns concern you long-term, talk it out calmly or seek advice from someone you trust.',
  },
  {
    id: 'SEL-025',
    topic: 'Digital Citizenship',
    sender: 'Amara 🔑',
    preview: 'Our school project needs a shared password for one account',
    statements: [
      'Shared classroom accounts should use passwords teachers control and rotate.',
      'Reusing the same password everywhere is a good way to remember it.',
      'Using your personal password for a school login is risky.',
    ],
    lieIndex: 1,
    why: 'Reusing passwords means one leak compromises every account. Use unique passwords — or a manager your family approves — and never recycle your personal login for group projects. Teachers can create shared credentials safely without students trading private ones.',
  },
  {
    id: 'SEL-026',
    topic: 'Social Emotional Learning',
    sender: 'Dylan 🎭',
    preview: 'People are subtweeting someone in our grade and I know who they mean',
    statements: [
      'Vague posts can still hurt because the target often recognizes themselves.',
      'Choosing not to like or share subtweets reduces their reach.',
      'Subtweets are fine because they never name anyone directly.',
    ],
    lieIndex: 2,
    why: 'Subtweeting is indirect bullying — the target usually knows, and so do bystanders. Engaging rewards the behavior. If it is about you or a friend, save evidence and talk to a trusted adult. Kindness means addressing conflict directly or not at all.',
  },
  {
    id: 'SEL-027',
    topic: 'Digital Citizenship',
    sender: 'Sophie 🌐',
    preview: 'I found someone\'s old embarrassing post from years ago',
    statements: [
      'If a post is public, reposting it to embarrass someone is always fair game.',
      'Digging up old posts to mock someone is a form of harassment.',
      'People grow and deserve not to be defined by one old moment.',
    ],
    lieIndex: 0,
    why: 'Public does not mean permission to humiliate. Resurfacing old content to mock someone can violate platform harassment rules and school conduct expectations. Delete what you shared, apologize if needed, and practice empathy — you would want the same grace someday.',
  },
  {
    id: 'SEL-028',
    topic: 'Social Emotional Learning',
    sender: 'Andre 💡',
    preview: 'My friend said "no offense" right before insulting someone in chat',
    statements: [
      'Saying "no offense" does not remove the sting of hurtful words.',
      'Online insults do not count if the speaker says they are joking afterward.',
      'You can call out unkind comments without attacking the person.',
    ],
    lieIndex: 1,
    why: 'Impact matters more than intent labels like "just joking." You can say, "That came across mean — let us keep it respectful." If you spoke harshly, own it and apologize specifically. Jokes that punch down are not required for friend groups to have fun.',
  },
  {
    id: 'SEL-029',
    topic: 'Digital Citizenship',
    sender: 'Lily 🕹️',
    preview: 'A stranger in my game keeps asking where I go to school',
    statements: [
      'Personal details like school name and schedule can be used to find you.',
      'You can decline personal questions and still keep playing.',
      'Sharing your school name with online strangers is safe if you are in a party voice chat.',
    ],
    lieIndex: 2,
    why: 'Strangers may not be who they claim — age, location, and intentions can be faked. Keep real-world details private, use generic usernames, and block or report pushy behavior. Tell a trusted adult if someone persists or makes you uncomfortable.',
  },
  {
    id: 'SEL-030',
    topic: 'Social Emotional Learning',
    sender: 'Jasmine 🌸',
    preview: 'I want to support a friend who is being talked about online',
    statements: [
      'You must publicly defend them in every comment thread to be a good friend.',
      'A private check-in shows you care without adding public drama.',
      'Listening without demanding every detail respects their boundaries.',
    ],
    lieIndex: 0,
    why: 'Public fights can escalate and sometimes embarrass the person you want to help. Ask what they need — company, reporting help, or adult support. Small private gestures often matter more than heroic comment battles.',
  },
  {
    id: 'SEL-031',
    topic: 'Digital Citizenship',
    sender: 'Caleb 📧',
    preview: 'I got an email saying my account will be deleted unless I click now',
    statements: [
      'Urgent threats in messages are a common phishing tactic.',
      'If an email looks official, the link inside is always legitimate.',
      'Going directly to the official site or app is safer than clicking email links.',
    ],
    lieIndex: 1,
    why: 'Scammers mimic logos and urgent language to rush you. Never click — open the app or type the URL yourself. Report phishing and tell an adult if you entered credentials. Real companies rarely threaten instant deletion by email alone.',
  },
  {
    id: 'SEL-032',
    topic: 'Social Emotional Learning',
    sender: 'Morgan 🔄',
    preview: 'Two friend groups are fighting and want me to share screenshots',
    statements: [
      'Forwarding private messages can break trust with both sides.',
      'Encouraging people to talk directly reduces triangle drama.',
      'Sharing screenshots always clears up who is right faster.',
    ],
    lieIndex: 2,
    why: 'Screenshot wars usually deepen conflict and expose private words out of context. Decline to be the messenger, suggest a mediated conversation, or involve an adult if it is serious. Your loyalty can be to kindness and privacy, not to carrying gossip.',
  },
  {
    id: 'SEL-033',
    topic: 'Digital Citizenship',
    sender: 'Ruby ♻️',
    preview: 'Is it okay to repost someone\'s art without tagging them?',
    statements: [
      'If it is on the internet, anyone can repost it without credit.',
      'Creators deserve credit when you share their work.',
      'Asking permission respects their time and ownership.',
    ],
    lieIndex: 0,
    why: 'Copyright and community norms still apply online. Credit the artist, link the original, or ask first — many creators say yes when asked respectfully. Uncredited reposts can get your account reported and hurt artists who rely on visibility.',
  },
  {
    id: 'SEL-034',
    topic: 'Social Emotional Learning',
    sender: 'Ethan 🌙',
    preview: 'I said something in a voice channel that sounded harsher than I meant',
    statements: [
      'Tone is easy to misread when you cannot see someone\'s face.',
      'Voice chat tone is always obvious so misunderstandings never happen.',
      'Clarifying your intent privately can prevent lasting misunderstandings.',
    ],
    lieIndex: 1,
    why: 'Sarcasm and frustration land differently without visual cues. If you misspoke, say so clearly: "That came out wrong — I did not mean it that way." If you are on the receiving end, ask before assuming the worst. Moving tough talks to video or in person can help.',
  },
  {
    id: 'SEL-035',
    topic: 'Digital Citizenship',
    sender: 'Valentina 📍',
    preview: 'My friend tagged our exact location at the mall in their story',
    statements: [
      'Location tags can reveal where you are in real time to wide audiences.',
      'You can ask friends not to tag you or post your location.',
      'Location tags only show city names, never specific places you visit.',
    ],
    lieIndex: 2,
    why: 'Many apps tag precise venues and update in real time. That can inform strangers or people you would not invite. Turn off location for posts, review tags before they go live, and discuss boundaries with friends about when check-ins are okay.',
  },
  {
    id: 'SEL-036',
    topic: 'Social Emotional Learning',
    sender: 'Quinn 🧩',
    preview: 'Someone sent me a "truth or dare" list that gets really personal',
    statements: [
      'You owe complete honesty to anyone who DMs you a dare list.',
      'You can refuse questions that feel too private or uncomfortable.',
      'Pressure to answer everything is a sign the game is not safe.',
    ],
    lieIndex: 0,
    why: 'Games that push for secrets, photos, or insults cross boundaries fast. "No" is a full sentence — you do not owe explanations. If someone keeps pushing, block, report, and tell a trusted adult. Real friends respect limits.',
  },
  {
    id: 'SEL-037',
    topic: 'Digital Citizenship',
    sender: 'Imani 🏫',
    preview: 'A TikTok trend asks students to rate teachers — should I join?',
    statements: [
      'Publicly rating adults can violate school rules and hurt reputations.',
      'Trends are harmless if deleting the video within an hour erases all impact.',
      'Trends that mock real people can have consequences beyond views.',
    ],
    lieIndex: 1,
    why: 'Videos can be screenshotted, reuploaded, or seen by staff before you delete. Rating or mocking teachers can lead to discipline and damaged relationships. Choose trends that do not target real people, or skip them — your future self will thank you.',
  },
  {
    id: 'SEL-038',
    topic: 'Social Emotional Learning',
    sender: 'Jackson 🎤',
    preview: 'My friend vented about me in a private story I was not meant to see',
    statements: [
      'Finding out secondhand can hurt — your feelings are valid.',
      'A calm conversation later works better than firing back publicly.',
      'If they vented online, you should expose their story to everyone immediately.',
    ],
    lieIndex: 2,
    why: 'Retaliating by sharing their private story spreads more pain and makes you part of the problem. Cool off, then talk directly or with a mediator. If venting included lies or harassment, involve an adult — but revenge posts rarely fix friendships.',
  },
  {
    id: 'SEL-039',
    topic: 'Digital Citizenship',
    sender: 'Sara 🧠',
    preview: 'I use the same username everywhere — is that a problem?',
    statements: [
      'Usernames never connect across apps so criminals cannot trace you.',
      'Consistent usernames can link your gaming, social, and school identities.',
      'Separate usernames for public and private spaces add a layer of privacy.',
    ],
    lieIndex: 0,
    why: 'Search tools and determined strangers can connect dots across platforms. Consider different handles for gaming versus personal social life, and avoid usernames with birth years or full names. Privacy is about making linking harder, not impossible.',
  },
  {
    id: 'SEL-040',
    topic: 'Social Emotional Learning',
    sender: 'Micah 🫶',
    preview: 'I want to compliment someone online but worry it will seem weird',
    statements: [
      'Specific, kind comments can brighten someone\'s day.',
      'Kind comments online always come across as flirting or creepy.',
      'Compliments about effort or character land better than appearance-only remarks.',
    ],
    lieIndex: 1,
    why: 'Thoughtful kindness is rarely creepy — tone and context matter. "Your project explanation helped me" or "Thanks for standing up for them" feels genuine. Avoid repeated DMs after someone does not reply, and respect boundaries if they seem uncomfortable.',
  },
  {
    id: 'SEL-041',
    topic: 'Digital Citizenship',
    sender: 'Olivia 🚨',
    preview: 'Someone posted a threat toward our school in a group chat',
    statements: [
      'Threats should be reported to a trusted adult immediately.',
      'Do not forward threats widely — that can spread panic and tip off harmful actors.',
      'Online threats are never serious if they use jokes or memes.',
    ],
    lieIndex: 2,
    why: 'Schools and law enforcement assess every threat — "joke" defenses do not make them safe. Tell an adult right away, save evidence, and avoid reposting. Spreading threats can interfere with investigations and frighten classmates unnecessarily.',
  },
  {
    id: 'SEL-042',
    topic: 'Social Emotional Learning',
    sender: 'Ryan 🌊',
    preview: 'We are planning a surprise party but the guest of honor is in the chat',
    statements: [
      'Keeping secrets in a shared group chat always works if you tell everyone "no spoilers."',
      'Surprises can backfire if the person feels left out of planning threads.',
      'A separate chat or code words reduce accidental spoilers.',
    ],
    lieIndex: 0,
    why: 'Notifications, accidental replies, and curious scrolling ruin surprises fast. Move planning to a chat without the guest or use a label like "gift committee." If they feel hurt by secrecy, explain kindly — empathy matters as much as the surprise.',
  },
  {
    id: 'SEL-043',
    topic: 'Digital Citizenship',
    sender: 'Keisha 📚',
    preview: 'Someone asked me to send homework answers over Snap',
    statements: [
      'Sharing graded work can count as cheating for both people.',
      'Sending answers privately never counts as cheating if the teacher does not see it.',
      'Offering to explain concepts helps without copying answers.',
    ],
    lieIndex: 1,
    why: 'Cheating policies cover sharing work even in DMs — and you both risk consequences. Helping means discussing steps, not photographing answers. If you are stuck, ask the teacher, a tutor, or a classmate for legitimate study help.',
  },
  {
    id: 'SEL-044',
    topic: 'Social Emotional Learning',
    sender: 'Alex 🪞',
    preview: 'I compared my life to influencers and felt terrible all day',
    statements: [
      'Curated feeds often show highlights, not everyday reality.',
      'Taking breaks from accounts that hurt your mood is self-care.',
      'If someone looks perfect online, their life is definitely better than yours.',
    ],
    lieIndex: 2,
    why: 'Filters, staging, and selective posting hide normal struggles. Comparison steals joy from your real life. Mute or unfollow triggers, follow diverse creators, and talk to someone if scrolling consistently brings you down.',
  },
  {
    id: 'SEL-045',
    topic: 'Digital Citizenship',
    sender: 'Brooke 🔇',
    preview: 'My little cousin keeps mic-spamming in our family game night call',
    statements: [
      'There is no way to manage voice chat behavior without yelling at people.',
      'Muting disruptive mics keeps the session fun for everyone.',
      'Explaining voice-chat etiquette calmly can teach younger kids.',
    ],
    lieIndex: 0,
    why: 'Platform mute controls, push-to-talk settings, and clear family rules work better than shouting. Kids often need one simple rule at a time. Model calm communication — gaming together is a chance to practice digital citizenship at home.',
  },
  {
    id: 'SEL-046',
    topic: 'Social Emotional Learning',
    sender: 'Daniel 🏳️',
    preview: 'People are misgendering a classmate in an online fan server',
    statements: [
      'Using someone\'s chosen name and pronouns shows respect.',
      'Pronouns online do not matter because nobody uses real names anyway.',
      'Correcting gently — "they use she/her" — can support the person targeted.',
    ],
    lieIndex: 1,
    why: 'Chosen names and pronouns matter in digital spaces too — misgendering can harm mental health and violate server rules. If you mess up, apologize briefly and try again. Support classmates by backing their identity consistently, online and off.',
  },
  {
    id: 'SEL-047',
    topic: 'Digital Citizenship',
    sender: 'Yuki 💾',
    preview: 'My phone auto-backed up photos I did not want saved to the cloud',
    statements: [
      'Cloud backups can sync sensitive photos across devices and accounts.',
      'Reviewing backup and privacy settings helps you control what is stored.',
      'Deleted photos always disappear from every backup instantly everywhere.',
    ],
    lieIndex: 2,
    why: 'Backups and shared family accounts can keep copies after you delete locally. Check Google Photos, iCloud, or similar settings with a parent or guardian. Turn off auto-upload for sensitive folders and use device passcodes to protect privacy.',
  },
  {
    id: 'SEL-048',
    topic: 'Social Emotional Learning',
    sender: 'Nate ⚖️',
    preview: 'I accidentally liked an old post while stalking someone\'s profile',
    statements: [
      'One accidental like always ruins your reputation permanently at school.',
      'Accidental likes happen — most people do not make a big deal of one notification.',
      'Obsessively checking someone\'s profile can increase anxiety more than it helps.',
    ],
    lieIndex: 0,
    why: 'A single like is usually forgotten in a day. If it feels awkward, you can laugh it off or leave it — do not spiral. If profile-checking stresses you out, mute the account and focus on offline friendships and hobbies that build confidence.',
  },
  {
    id: 'SEL-049',
    topic: 'Digital Citizenship',
    sender: 'Camila 📝',
    preview: 'Our club wants to post student full names and photos on a public page',
    statements: [
      'Families should consent before student names and faces go fully public.',
      'School clubs can post any student info online without permission.',
      'Using first names only or group shots can reduce privacy risks.',
    ],
    lieIndex: 1,
    why: 'Many districts require media releases for public identification of minors. Leaders should collect permission slips or use privacy-friendly formats. If you are uncomfortable being posted, say so — adults can adjust plans to include you safely.',
  },
  {
    id: 'SEL-050',
    topic: 'Social Emotional Learning',
    sender: 'Jordan 📱',
    preview: 'End of unit — what is the best mindset for being online tomorrow?',
    statements: [
      'Pause before posting when emotions are high.',
      'Ask for help from trusted adults when something feels wrong.',
      'The best online strategy is never making mistakes so you never need help.',
    ],
    lieIndex: 2,
    why: 'Everyone slips up online — growth comes from repairing harm and learning. Pausing, seeking help, and practicing empathy beat pretending perfection. Digital citizenship is a habit you build one choice at a time, not a score you either pass or fail forever.',
  },
];

export const TWO_TRUTHS = TWO_TRUTHS_DATA;

const BY_ID = new Map(TWO_TRUTHS.map((item) => [item.id, item]));

/** Look up a Two Truths item by id, or null if missing. */
export function getTwoTruthById(id) {
  return BY_ID.get(id) || null;
}

/** Normalizes a Set, array, or any iterable of ids into an array. */
function toIdList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value[Symbol.iterator] === 'function') return [...value];
  return [];
}

/**
 * Picks one random Two Truths item, preferring ids not in `excludeIds`.
 * Falls back to any item when every id has been excluded.
 *
 * @param {object} rng  seeded rng from util.js (needs .shuffle or callable random)
 * @param {Set<string>|string[]} [excludeIds]
 * @returns {object|null} one authored item, or null if the bank is empty
 */
export function drawTwoTruths(rng, excludeIds) {
  if (!TWO_TRUTHS.length) return null;

  const excluded = new Set(toIdList(excludeIds));
  const unseen = TWO_TRUTHS.filter((item) => !excluded.has(item.id));
  const pool = unseen.length ? unseen : TWO_TRUTHS;

  const pick = (list) => {
    if (rng && typeof rng.shuffle === 'function') {
      return rng.shuffle(list.slice())[0];
    }
    const roll = rng && typeof rng === 'function' ? rng() : Math.random();
    return list[Math.floor(roll * list.length)];
  };

  return pick(pool);
}

/** Total Two Truths items available. */
export const TWO_TRUTHS_COUNT = TWO_TRUTHS.length;
