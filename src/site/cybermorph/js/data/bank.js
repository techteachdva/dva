/**
 * The Word Bank: hundreds of real words, each with its morphemes and a plain meaning.
 *
 * Rotling waves, Rot Return waves, review Rotlings, Overclock Mode, the Morph Compiler's
 * real-word check and practice requests all draw from here, so every visit feels different.
 * Format: 'word|morpheme ids|meaning'. The audit (scripts/audit-cybermorph-bank.mjs)
 * rebuilds every word from its ids and fails if the spelling engine disagrees.
 */

const ANGLO = `
helpful|help ful|full of help; giving help; useful
helper|help er|one who helps
helpless|help less|without help
unhelpful|un help ful|not giving help
helpfulness|help ful ness|the state of being helpful
playful|play ful|full of fun
player|play er|one who plays
playing|play ing|play happening now; having fun right now
played|play ed|play in the past; had fun in the past
kindness|kind ness|the state of being kind
unkind|un kind|not kind
kindly|kind ly|in a kind way
friendly|friend ly|acting like a friend
unfriendly|un friend ly|not friendly
friendship|friend ship|the bond between friends
friendliness|friend ly ness|the state of being friendly
unfriendliness|un friend ly ness|the state of being unfriendly
careful|care ful|full of care; paying close attention
careless|care less|without care; not paying attention
carelessness|care less ness|the state of not taking care
carefully|care ful ly|in a careful way
hopeful|hope ful|full of hope
hopeless|hope less|without hope
hoping|hope ing|wishing for something now
hoped|hope ed|wished for in the past
fearless|fear less|without fear; brave
fearful|fear ful|full of fear
fearlessness|fear less ness|the state of being brave
runner|run er|one who runs
running|run ing|run happening now; moving fast on foot now
stopped|stop ed|halted in the past
biggest|big est|the most big
darkness|dark ness|the state of being dark
darken|dark en|to make dark
sleepy|sleep y|wanting to sleep
sleepless|sleep less|without sleep
sleepiness|sleep y ness|the state of being sleepy
oversleep|over sleep|to sleep too long
misread|mis read|to read wrongly
reader|read er|one who reads
foresee|fore see|to see before it happens
understand|under stand|to get the meaning
misunderstand|mis under stand|to understand wrongly
overwhelming|over whelm ing|too much to handle
childhood|child hood|the time of being a child
childish|child ish|acting like a little child
childless|child less|without children
kingdom|king dom|the land a king rules
freedom|free dom|the state of being free
freely|free ly|in a free way
midnight|mid night|the middle of the night
midday|mid day|the middle of the day
midway|mid way|halfway along
homeward|home ward|toward home
homeless|home less|without a home
sunny|sun y|full of sunshine
sunless|sun less|without sun
sunshine|sun shine|the light of the sun
rainy|rain y|full of rain
rainbow|rain bow|a colorful arc in the sky
windy|wind y|full of wind
snowy|snow y|covered with snow
snowball|snow ball|a ball of packed snow
handful|hand ful|as much as a hand holds
handy|hand y|useful; close by
lightness|light ness|the state of being light
lighthouse|light house|a tower with a guiding light
teacher|teach er|one who teaches
learner|learn er|one who learns
speaker|speak er|one who speaks
thinker|think er|one who thinks
wildness|wild ness|the state of being wild
quickly|quick ly|in a fast way
slowly|slow ly|in a slow way
brightness|bright ness|the state of being bright
brighten|bright en|to make brighter
coldness|cold ness|the state of being cold
warmly|warm ly|in a warm way
thankful|thank ful|full of thanks
thankless|thank less|getting no thanks
heartless|heart less|without kindness
sweetness|sweet ness|the state of being sweet
sweeten|sweet en|to make sweet
mindful|mind ful|paying careful attention
mindless|mind less|without thought
restless|rest less|unable to rest
restful|rest ful|calm and peaceful
truthful|truth ful|telling the truth
lovely|love ly|beautiful; pleasing
lonesome|lone some|feeling alone
awesome|awe some|causing awe; amazing
tiresome|tire some|causing tiredness; boring
wonderful|wonder ful|full of wonder
bedroom|bed room|a room for sleeping
butterfly|butter fly|an insect with bright wings
football|foot ball|a game played with a ball and feet
blackboard|black board|a dark board for chalk
outside|out side|the outer side
outrun|out run|to run faster than
builder|build er|one who builds
singer|sing er|one who sings
singing|sing ing|sing happening now; making music now
swimmer|swim er|one who swims
swimming|swim ing|moving through water now
shopper|shop er|one who shops
shopping|shop ing|buying things now
hopping|hop ing|jumping on one foot now
happiness|happy ness|the state of being happy
unhappy|un happy|not happy
happily|happy ly|in a happy way
unhappiness|un happy ness|the state of being unhappy
baker|bake er|one who bakes
baking|bake ing|cooking in an oven now
maker|make er|one who makes
writer|write er|one who writes
writing|write ing|putting words on paper now
toothbrush|tooth brush|a brush for teeth
waterfall|water fall|water falling over a cliff
earthquake|earth quake|a shaking of the ground
beehive|bee hive|a home for bees
seashell|sea shell|the shell of a sea animal
starfish|star afish|a star-shaped sea animal
weekend|week end|the end of the week
endless|end less|without an end
unfair|un fair|not fair
fairness|fair ness|the state of being fair
cleverness|clever ness|the state of being clever
softly|soft ly|in a soft way
soften|soft en|to make soft
loudly|loud ly|in a loud way
eastward|east ward|toward the east
westward|west ward|toward the west
backward|back ward|toward the back
afternoon|after noon|the time after noon
neighborhood|neighbor hood|the area where neighbors live
craftsman|craft s man|a person skilled at a craft
kicked|kick ed|hit with the foot in the past
jumping|jump ing|leaping now
walker|walk er|one who walks
talker|talk er|one who talks
wordless|word less|without words
youngest|young est|the most young
strongest|strong est|the most strong
weakness|weak ness|the state of being weak
weaken|weak en|to make weak
dreamer|dream er|one who dreams
dreamless|dream less|without dreams
joyful|joy ful|full of joy
joyless|joy less|without joy
boxes|box es|more than one box
wishes|wish es|more than one wish
dishes|dish es|more than one dish
bookish|book ish|loving books
handbook|hand book|a small book of instructions
sunset|sun set|when the sun goes down
household|house hold|everyone living in a house
drawing|draw ing|a picture made with lines
drawback|draw back|a problem; a downside
keyboard|key board|the board of keys you type on
firewall|fire wall|a wall that blocks fire or data
download|down load|to bring a file down to your device
network|net work|a web of connected computers
laptop|lap top|a computer that sits on your lap
unhelpfulness|un help ful ness|the state of not being helpful
darkest|dark est|the most dark|extra
brightest|bright est|the most bright|extra
sweetest|sweet est|the most sweet|extra
`;

const LATIN = `
transform|trans form|to change shape
reform|re form|to shape again; to form again; to improve
deform|de form|to shape down; to spoil the shape of
inform|in2 form|to give facts to
conform|con form|to shape together; to fit the rules
formation|form ation|the act of forming
transformation|trans form ation|a complete change
information|in2 form ation|facts and knowledge
formal|form al|following set rules
performance|per form ance|doing something for an audience
transport|trans port|to carry across
export|ex port|to carry goods out of a country
import|in2 port|to carry into; to carry goods into a country
report|re port|to carry back; to carry news back
support|sub port|to carry from under; to help
portable|port able|able to be carried
deport|de port|to carry away; to send out of a country
transportation|trans port ation|the act of carrying across
importance|in2 port ance|the state of mattering
important|in2 port ant|carrying weight; mattering
interrupt|inter rupt|to break between; to break in between someone speaking
interruption|inter rupt ion|the act of breaking in
erupt|e rupt|to burst out
eruption|e rupt ion|a bursting out
disrupt|dis rupt|to break apart
disruption|dis rupt ion|the act of breaking apart
disruptive|dis rupt ive|tending to break things apart
rupture|rupt ure|a break or burst
corrupt|con rupt|to break together; broken by dishonesty
corruption|con rupt ion|the act of being dishonest
tractor|tract or|a machine that pulls
attract|ad tract|to pull toward
attraction|ad tract ion|a pull toward something
attractive|ad tract ive|tending to pull others in
subtract|sub tract|to pull away; to take away
subtraction|sub tract ion|the act of taking away
extract|ex tract|to pull out
distract|dis tract|to pull attention away
distraction|dis tract ion|something that pulls attention away
contract|con tract|to pull together; an agreement
retract|re tract|to pull back
traction|tract ion|grip that lets you pull
describe|de scribe|to write down about
subscribe|sub scribe|to sign up
prescribe|pre scribe|to write an order before
inscription|in2 script ion|words written into something
description|de script ion|words that describe
prescription|pre script ion|a doctor's written order
transcript|trans script|written across; a written copy
postscript|post script|written after; a note written after (P.S.)
inspect|in2 spect|to look into
inspector|in2 spect or|one who looks closely
inspection|in2 spect ion|a close look
respect|re spect|to look back; to look up to
respectful|re spect ful|showing respect
spectator|spect ate or|one who makes a watch; one who watches
prospect|pro spect|a look forward; a possibility
perspective|per spect ive|a point of view
special|spec ial|set apart; unusual
despicable|de spic able|deserving to be looked down on
construct|con struct|to build together
construction|con struct ion|the act of building
constructive|con struct ive|helpful for building up
destruction|de struct ion|the act of tearing down
destructive|de struct ive|tending to destroy
structure|struct ure|something built
instruct|in2 struct|to build knowledge in; to teach
instructor|in2 struct or|one who teaches
instruction|in2 struct ion|teaching; directions
instrument|in2 stru ment|a tool built for a job
indestructible|in de struct ible|not able to be destroyed
reconstruct|re con struct|to build again
predict|pre dict|to say before; to say what will happen
prediction|pre dict ion|a saying of what will happen
predictable|pre dict able|able to be told before
unpredictable|un pre dict able|not able to be told before
contradict|contra dict|to say against; to say the opposite
contradiction|contra dict ion|a saying of the opposite
dictate|dict ate|to say aloud for others to write
dictator|dict ate or|one who makes a saying; a ruler who says what goes
dictionary|dict ion ary|a place for the result of telling; a book of what words mean
indicate|in2 dic ate|to point out
dedicate|de dic ate|to set apart for someone
transfer|trans fer|to carry across
refer|re fer|to carry back to; to mention
prefer|pre fer|to carry before; to like better
offer|ob fer|to bring toward someone
differ|dis fer|to be unlike
difference|dis fer ence|the state of carrying apart; the way things are unlike
different|dis fer ent|carrying apart; not the same
conference|con fer ence|the state of bringing together; a meeting to bring ideas together
reference|re fer ence|a source you point back to
preference|pre fer ence|what you like better
infer|in2 fer|to carry in a conclusion; to figure out
transmit|trans mit|to send across
submit|sub mit|to send in; to give in
admit|ad mit|to let in
emit|e mit|to send out
permit|per mit|to let through; to allow
commit|con mit|to send yourself into; to promise
mission|miss ion|the act of sending; a task you are sent to do
dismiss|dis miss|to send away
permission|per miss ion|the act of allowing
admission|ad miss ion|the act of letting in
transmission|trans miss ion|the act of sending across
submission|sub miss ion|something sent in
commitment|con mit ment|a promise
transmitted|trans mit ed|sent across in the past
submitted|sub mit ed|sent in in the past
conduct|con duct|to lead
conductor|con duct or|one who leads
product|pro duct|to lead forward; something made
production|pro duct ion|the act of making
deduct|de duct|to lead away; to subtract
reduce|re duce|to lead back; to make smaller
produce|pro duce|to lead forward; to bring into being
introduce|intro duce|to lead inward
education|e duc ation|the act of leading out of not knowing
factory|fact ory|a place for making; a place where things are made
factor|fact or|a thing that makes; something that makes a result
effect|ex fect|a result
effective|ex fect ive|making a result
affect|ad fect|to make toward; to act on
infect|in2 fect|to make into sickness; to make sick
infection|in2 fect ion|a sickness that gets in
perfect|per fect|made completely; without flaws
defect|de fect|a flaw
sufficient|sub fic i ent|enough
efficient|ex fic i ent|making things well with no waste
proficient|pro fic i ent|skilled; able to make well
beneficial|bene fic ial|doing good
contain|con tain|to hold together
container|con tain er|something that holds things
retain|re tain|to hold back; to keep
obtain|ob tain|to get hold of
attain|ad tain|to hold toward; to reach; to get hold of
detain|de tain|to hold back
pertain|per tain|to hold completely; to have to do with
detention|de tent ion|being held after
attention|ad tent ion|holding your mind toward
retention|re tent ion|the act of keeping
tenant|ten ant|one who holds a rented place
continent|con tin ent|holding together; a large body of land held together
continuous|con tinu ous|holding together without a break
continuity|con tinu ity|the state of going on without a break
visible|vis ible|able to be seen
invisible|in vis ible|not able to be seen
vision|vis ion|the act of seeing
revision|re vis ion|a second look; a change
supervisor|super vis or|one who oversees
television|tele vis ion|seeing from far away
revise|re vise|to look at again and change
advise|ad vise|to see toward; to help someone see what to do
supervise|super vise|to see beyond; to watch over
evident|e vid ent|easy to see
evidence|e vid ence|what makes something clear to see
provide|pro vide|to see forward; to supply
capable|cap able|able to take on a task
capture|capt ure|the act of seizing; catching hold
captive|capt ive|tending to take; one who has been taken
receive|re ceive|to take back; to get
deceive|de ceive|to take away the truth; to trick
perceive|per ceive|to take in through the senses
conceive|con ceive|to take together; to take in an idea
deceit|de ceit|a taking away; a trick
conceit|con ceit|a taking together; too much pride
accept|ad cept|to take willingly
except|ex cept|to take out; taken out; leaving out
intercept|inter cept|to take between; to catch
reception|re cept ion|a taking in; a welcome
perception|per cept ion|what you take in through the senses
deception|de cept ion|the act of tricking
concept|con cept|to take together; an idea taken in
recipient|re cip i ent|one who receives
anticipate|anti cip ate|to take before; to expect
station|stat ion|the act of standing; a place where things stand
stature|stat ure|the result of standing; how tall someone stands
stationary|stat ion ary|standing still
insist|in2 sist|to stand firm
resist|re sist|to stand against
assist|ad sist|to stand toward; to stand by to help
consist|con sist|to stand together; to be made of
persist|per sist|to stand through; to stand firm through
resistance|re sist ance|the act of standing against
assistant|ad sist ant|one who helps
consistent|con sist ent|standing steady
persistent|per sist ent|not giving up
constitute|con stit ute|to set up together
institute|in2 stit ute|something set up
substitute|sub stit ute|one set in place of another
constitution|con stit ute ion|the set-up rules of a country
compose|con pose|to put together
expose|ex pose|to put out in the open
propose|pro pose|to put forward
suppose|sub pose|to put under; to guess
impose|in2 pose|to put on
deposit|de posit|to put down
position|posit ion|the act of placing; where something is placed
composition|con posit ion|something put together
positive|posit ive|tending to place; placed firmly; sure
opponent|ob pon ent|one placed against you
component|con pon ent|a part put together with others
exponent|ex pon ent|a number placed out above
postpone|post pone|to put after; to delay
apply|ad ply|to fold toward; to put to use
reply|re ply|to fold back; to answer
supply|sub ply|to fill up from below
multiply|multi ply|to fold many times
imply|in2 ply|to fold in; to fold in a hidden meaning
supplier|sub ply er|one who supplies
complicate|con plic ate|to fold together; to make hard
application|ad plic ation|the act of putting to use
implication|in2 plic ation|a hidden meaning
applicable|ad plic able|able to be put to use
nonstop|non stop|without stopping
nonsense|non sense|words with no meaning
social|soci al|relating to being with others
associate|ad soci ate|to join with
discover|dis cover|to uncover; to find
discovery|dis cover yn|the act of finding
recovery|re cover yn|the act of getting back
uncover|un cover|to take the cover off
deliver|de liver|to hand over
delivery|de liver yn|the act of handing over
credible|cred ible|able to be believed
incredible|in cred ible|hard to believe
audible|aud ible|able to be heard
inaudible|in aud ible|not able to be heard
audience|aud i ence|the people who hear
motion|mot ion|the act of moving
emotion|e mot ion|a feeling that moves you
motor|mot or|one that moves; a thing that moves
pedal|ped al|a lever pushed by the foot
immobile|in mobile|not able to move
socialize|soci al ize|to make friends; to mix with others
eject|e ject|to throw out
reject|re ject|to throw back; to refuse
rejection|re ject ion|the act of refusing
project|pro ject|to throw forward
projector|pro ject or|a machine that throws light forward
inject|in2 ject|to throw in
injection|in2 ject ion|a shot that puts medicine in
objection|ob ject ion|a statement against something
subject|sub ject|to throw under; a topic placed under study
facile|fac ile|done with ease
aquatic|aqua tic|living in water
manufacture|manu fact ure|to make by hand or machine
benefactor|bene fact or|one who does good
stable|sta ble|able to stand firm
unstable|un sta ble|not steady
opposite|ob pos ite|placed against; completely different
composite|con pos ite|made of parts put together
scribble|scrib ble|to write messily
biweekly|bi week ly|every two weeks
deduce|de duce|to lead away a conclusion; to infer|extra
proscribe|pro scribe|to write forward; to forbid|extra
defer|de fer|to carry away; to put off|extra
actor|act or|one who does; one who acts|extra
caption|capt ion|the act of taking; words taken with a picture|extra
faction|fact ion|the act of making; a group made inside a larger group|extra
tenure|ten ure|the act of holding; the time something is held|extra
continence|con tin ence|the state of holding together; holding oneself back|extra
`;

const GREEK = `
photograph|photo graph|light writing; a picture made with light
photography|photo graph gy|the art of making pictures with light
photographer|photo graph er|one who takes photographs
biography|bio graph gy|the written story of a life
autobiography|auto bio graph gy|a story of your own life
autograph|auto graph|self writing; writing your own name yourself
geography|geo graph gy|writing about the earth
telegraph|tele graph|far writing; a machine that writes messages from far away
graphic|graph ic|relating to writing or drawing
phonograph|phon o graph|a machine that writes and plays sound
diagram|dia gram|through something written or drawn; a drawing that explains
program|pro gram|forward something written or drawn; a plan written ahead
telegram|tele gram|a message written from far away
monogram|mono gram|one something written or drawn; letters joined into one design
biology|bio log gy|the study of life
geology|geo log gy|earth study; the study of the earth
ecology|eco log gy|house study; the study of living things and their homes
zoology|zoo log gy|animal study; the study of animals
psychology|psych o log gy|the study of the mind
technology|techn o log gy|the study and use of tools
chronology|chron o log gy|the order of events in time
morphology|morph o log gy|shape study; the study of the shapes of words
anthropology|anthrop o log gy|human study; the study of humans
cardiology|cardi o log gy|heart study; the study of the heart
neurology|neur o log gy|nerve study; the study of nerves
pathology|path o log gy|disease study; the study of disease
trilogy|tri log gy|a set of three stories
biologist|bio log ist|one who studies life
geologist|geo log ist|one who studies the earth
zoologist|zoo log ist|one who studies animals
psychologist|psych o log ist|one who studies the mind
technological|techn o log ic al|relating to technology
chronological|chron o log ic al|in order of time
logical|log ic al|making sense step by step
thermometer|therm o meter|a tool that measures heat
hydrometer|hydro meter|a tool that measures liquids
geometry|geo metr gy|the math of shapes and space
symmetry|syn metr gy|the same measure on both sides
diameter|dia meter|the measure across; the measure across a circle
telescope|tele scope|far looking; a tool to look at things far away
microscope|micro scope|a tool to see tiny things
microscopic|micro scope ic|too small to see without a microscope
telephone|tele phone|a device that carries a voice far
microphone|micro phone|a device that makes sound louder
megaphone|mega phone|a horn that makes a voice huge
homophone|homo phone|a same sound; a word that sounds the same as another
symphony|syn phon gy|sounds played together
phonics|phon ics|sound study; the study of letter sounds
photosynthesis|photo syn the sis|how plants make food with light
antibiotic|anti bio tic|medicine that works against germs
biosphere|bio sphere|the part of earth where life exists
astronomy|astro nom gy|the study of star law; the study of stars and space
astronomer|astro nom er|one who studies star law; one who studies space
astrophysics|astro phys ics|the physics of stars
cosmic|cosm ic|relating to the world; relating to the universe
cosmology|cosm o log gy|the study of the universe
microcosm|micro cosm|a small world that mirrors a big one
philanthropy|phil anthrop gy|love for humankind; giving to help
sympathy|syn path gy|feeling with someone
telepathy|tele path gy|feeling from far away; mind reading
antipathy|anti path gy|a feeling against something
philosophy|phil o soph gy|the study of loving wisdom
philosopher|phil o soph er|one who loves wisdom
polygon|poly gon|a shape with many angles
diagonal|dia gon al|a line across from angle to angle
monologue|mono logue|a talk by one; a speech by one person
dialogue|dia logue|a talk across; a talk between people
hyperactive|hyper act ive|too active
hypothermia|hypo therm ia|under heat; a condition of having too little body heat
hypodermic|hypo derm ic|relating to under the skin; going under the skin
economy|eco nom gy|the rules of a household; how a household or country manages money
economic|eco nom ic|relating to money and resources
hydrogen|hydro gen|the gas that forms water
antigen|anti gen|an against birth; something the body makes antibodies against
photogenic|photo gen ic|looking good in photos
synonym|syn onym|a same name; a word with the same meaning
antonym|anti onym|an against name; a word with the opposite meaning
homonym|homo onym|a same name; a word spelled or said the same as another
monarch|mono arch|a single ruler
monarchy|mono arch gy|rule by one person
democracy|demo cracy|rule by the people
democrat|demo crat|one who supports rule by the people
autocrat|auto crat|a ruler with total power
kinetic|kine tic|relating to movement
cyclist|cycl ist|one who rides a circle; one who rides a bicycle
cyclic|cycl ic|relating to a circle; happening in circles or cycles
physics|phys ics|nature study; the study of matter and energy
physical|phys ic al|relating to the body or nature
physicist|phys ic ist|one who studies physics
atmosphere|atmo sphere|the air around a planet
technical|techn ic al|relating to skills and tools
psychic|psych ic|relating to the mind
dehydrate|de hydr ate|to take water out of
heroic|hero ic|relating to a brave person; brave like a hero
heroism|hero ism|the acts of a hero; great bravery
automobile|auto mobile|a car; a self-moving machine
graphics|graph ics|the study of writing; pictures and designs made for screens or print
photographic|photo graph ic|relating to photographs
biographer|bio graph er|one who writes the story of a life
geographic|geo graph ic|relating to geography
polygraph|poly graph|a machine that writes many body signals at once
autobiographical|auto bio graph ic al|relating to the story of your own life
telescopic|tele scope ic|able to see far; sliding in and out
microbiology|micro bio log gy|the study of tiny living things
microbiologist|micro bio log ist|one who studies tiny living things
biological|bio log ic al|relating to living things
geological|geo log ic al|relating to rocks and the earth
ecological|eco log ic al|relating to living things and their homes
ecologist|eco log ist|one who studies living things and their homes
psychological|psych o log ic al|relating to the mind
astrology|astro log gy|star study; an old belief that stars shape lives
astronomical|astro nom ic al|relating to stars; hugely large
economical|eco nom ic al|careful with money
economist|eco nom ist|one who studies how a household or country manages money and trade
economics|eco nom ics|the study of money and trade
economize|eco nom ize|to save money
geometric|geo metr ic|made of shapes and lines
symmetric|syn metr ic|the same on both sides
symmetrical|syn metr ic al|the same on both sides
trigonometry|tri gon o metr gy|the math of triangles
polygonal|poly gon al|having many angles
phonic|phon ic|relating to sound
symphonic|syn phon ic|relating to a symphony
polyphonic|poly phon ic|made of many sounds at once
hydrology|hydr o log gy|the study of water
cardiogram|cardi o gram|a drawing of the heartbeat
cardiologist|cardi o log ist|one who studies the heart; a heart doctor
neurologist|neur o log ist|one who studies the nerves; a nerve and brain doctor
pathologist|path o log ist|one who studies disease
anthropologist|anthrop o log ist|one who studies humans
philosophical|phil o soph ic al|relating to the love of wisdom
synthetic|syn the tic|put together by people, not nature
hypothesis|hypo the sis|an idea put under testing
antithesis|anti the sis|the exact opposite
photosynthetic|photo syn the tic|making food from light
democratic|demo crat ic|relating to rule by the people
autocratic|auto crat ic|ruling with total power
prologue|pro logue|a talk forward; a speech before the story
atmospheric|atmo sphere ic|relating to the air around a planet
spherical|sphere ic al|shaped like a ball
antisocial|anti soci al|against being with others
hyperthermia|hyper therm ia|over heat; a condition of having too much body heat
thermal|therm al|relating to heat
chronic|chron ic|lasting a long time
synchronize|syn chron ize|to make happen at the same time
sympathize|syn path ize|to feel with someone
micrometer|micro meter|a tool that measures tiny distances
telephoto|tele photo|far light; a lens for taking pictures from far away
hydrophobia|hydro phob ia|a fear of water
triskaidekaphobia|tris kai deka phob ia|a fear of the number thirteen
philology|phil o log gy|love of words; the study of language|extra
astrologer|astro log er|one who studies stars; a person who says stars shape lives|extra
hypothermic|hypo therm ic|relating to too little heat; having too little body heat|extra
hyperthermic|hyper therm ic|relating to too much heat; having too much body heat|extra
`;

function parse(block, origin) {
  return block.trim().split('\n').filter(Boolean).map((line) => {
    const [word, ids, meaning, role] = line.split('|');
    return { word, ids: ids.trim().split(/\s+/), meaning, origin, extra: role === 'extra' };
  });
}

export const BANK = [...parse(ANGLO, 'anglo'), ...parse(LATIN, 'latin'), ...parse(GREEK, 'greek')];
