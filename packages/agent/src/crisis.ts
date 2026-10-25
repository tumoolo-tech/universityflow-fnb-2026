/**
 * The crisis protocol's first line (planning.md §4.3): a deterministic check on every message a
 * learner sends, before any model sees it.
 *
 * - **crisis**: signs of suicide, self-harm or abuse. Coaching stops. The learner gets a fixed,
 *   reviewed reply and the crisis card with verified helplines, whatever the model would have
 *   said. A model can fail; this can't.
 * - **concern**: distress that isn't an emergency. The model still answers, but is told to check
 *   in first, and the crisis card is shown with it.
 *
 * It errs towards showing help: a false alarm costs a learner a few seconds; a miss could cost
 * far more. The red-team suite (packages/evals) must pass 100% (hard rule 7).
 *
 * The phrases in isiZulu, isiXhosa, Sesotho, Setswana and Afrikaans are a starting set and must
 * be reviewed by first-language speakers before launch.
 */

export type DistressLevel = 'none' | 'concern' | 'crisis';
export type DistressTopic = 'suicide' | 'distress' | 'abuse' | 'substance' | 'emergency' | 'child';

export interface DistressAssessment {
  readonly level: DistressLevel;
  /** Which helplines to show, most relevant first. */
  readonly topics: ReadonlyArray<DistressTopic>;
}

interface Rule {
  readonly level: Exclude<DistressLevel, 'none'>;
  readonly topics: ReadonlyArray<DistressTopic>;
  readonly pattern: RegExp;
  /**
   * The rule matches a bare word ("suicide", "rape") that learners also use about a set work.
   * Only a topical rule can be softened by a literature question (see LITERATURE).
   */
  readonly topical?: true;
}

const SELF = '(?:myself|my self|meself)';
const SUICIDE: DistressTopic[] = ['suicide', 'distress', 'emergency'];
const ABUSE: DistressTopic[] = ['abuse', 'child', 'emergency'];

/** Anyone a learner might name when disclosing abuse (audit A10-04: one list for every rule). */
const RELATIVE =
  '(?:father|dad|mother|mom|mum|ma|uncle|aunt|aunty|auntie|stepfather|stepdad|stepmother|stepmom|stepmum|stepbrother|stepsister|boyfriend|girlfriend|bf|gf|ex|husband|wife|partner|teacher|brother|sister|cousin|grandfather|grandpa|grandmother|grandma|granny|gogo|mkhulu|neighbou?r|coach|pastor|guardian|roommate|roomie|housemate|flatmate|lecturer|tutor|landlord|landlady)';
const ABUSER = `(?:he|she|they|my (?:(?:mom|mum|mother|dad|father|aunt|sister|brother)'s )?${RELATIVE})`;
/** "My teacher hit me with a surprise test" is school talk, not abuse (audit A10-07). */
const NOT_SCHOOLWORK =
  '(?! with (?:a |an |the |another )?(?:\\d+[- ]?(?:page|word|mark|hour) )?(?:surprise |pop |big |hard |long |huge )?(?:tests?|quiz|questions?|assignments?|homework|tasks?|lot|ton|essays?|projects?|deadlines?|readings?|tutorials?|workload)\\b)';
/** "End it with my boyfriend" is a break-up, not a plan (A10-21). "With my boyfriend's gun" is not. */
const NOT_A_BREAKUP =
  "(?! with (?:him|her|them|(?:my|this|that|the|our) (?:[a-z']+ ){0,2}(?:boyfriend|girlfriend|bf|gf|bae|partner|ex|man|roommate|roomie|housemate|flatmate|situation|situationship|relationship|friendship|thing|group|lease|contract)\\b(?!'s)))";

const RULES: ReadonlyArray<Rule> = [
  // Suicide and self-harm.
  {
    level: 'crisis',
    topics: SUICIDE,
    // Every verb form: "cut myself", "cutting myself", "hurts myself"…
    pattern: new RegExp(
      `\\b(?:kill|hurt|harm|cut|hang|poison|burn|starv)(?:s|ed|t|ing|ting|e|ed)? ${SELF}\\b`,
    ),
  },
  { level: 'crisis', topics: SUICIDE, pattern: /\bsuicidal\b|\bself[- ]?harm|\bkms\b|\bkys\b/ },
  { level: 'crisis', topics: SUICIDE, pattern: /\bsuicide\b/, topical: true },
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\bcut(?:s|ting)? my (?:wrists?|arms?|legs?|thighs?)\b|\bcutting (?:again|myself)\b|\b(?:been|keep|kept|started|start) cutting\b/,
  },
  // Methods (audit A10-02): pills after any possessive ("all my mom's pills"), poison, jumping.
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\b(?:took|take|taking|swallowed|swallow) (?:all (?:of )?(?:[a-z']+ ){1,2}|a (?:bunch|lot|handful) of |too many |loads of )(?:pills|tablets)\b|\b(?:took|swallowed|downed) (?:a|the|my) (?:whole |full |entire )?(?:box|bottle|packet|pack|strip|tub|container) of (?:[a-z']+ ){0,2}(?:pills|tablets|panados?|painkillers)\b|\b(?:take|taking|swallow|swallowing|down|downing) (?:a|the|my) (?:whole|full|entire) (?:box|bottle|packet|pack|strip|tub|container) of (?:[a-z']+ ){0,2}(?:pills|tablets|panados?|painkillers)\b|\brat poison\b|\b(?:drink|drank|drinking|swallow|swallowed|take|took) (?:the |some )?poison\b|\bjump(?:ing)? (?:off|from) (?:a|the|this|that) (?:bridge|building|roof|cliff|balcony)\b|\b(?:jump|step|throw myself) in front of (?:a|the) (?:train|car|taxi|truck|bus)\b/,
  },
  // Plans, farewells and "nobody would miss me" (audit A10-02).
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\bgoodbye (?:letters?|notes?|everyone|everybody|forever|world)\b|\bthis is my last message\b|\bplanning how to (?:do it|end it|kill)\b|\b(?:nobody|no one|noone) (?:would|will) (?:even )?miss me\b|\bwish(?:ed)? i (?:was|were|had) never (?:been )?born\b|\b(?:don't|do not|can't|cannot) see (?:a|any) future\b|\b(?:want|need) (?:it all|everything|the pain) to stop (?:forever|for good|permanently)\b/,
  },
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern: new RegExp(
      `\\b(?:end|ending|take|taking) (?:my|me) (?:own )?life\\b|\\bend(?:ing)? (?:it all|everything)\\b|\\b(?:thinking (?:of|about)|want to|wanna|going to|gonna|i will|i'll) end(?:ing)? it\\b${NOT_A_BREAKUP}`,
    ),
  },
  {
    level: 'crisis',
    topics: SUICIDE,
    // "Wanna" needs no "to" (audit A10-01). "Die my hair blue" is not a death wish.
    pattern:
      /\b(?:want(?:ed)? to|wanna|going to|gonna|ready to) (?:die\b(?! (?:my|your|his|her|their|the) (?:hair|clothes|shirt|shoes|jeans)| laughing\b| of laughter\b)|be dead\b)|\bwish(?:ed)? i (?:was|were|could be) dead\b|\bwish(?:ed)? i (?:could|would) (?:just )?die\b(?! (?:my|your|his|her|their|the) (?:hair|clothes|shirt|shoes|jeans)| laughing\b| of laughter\b)|\bbetter off (?:dead|without me)\b/,
  },
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\b(?:don't|do not) (?:want to|wanna) (?:live|be alive|wake up|exist|be here)\b|\bno (?:reason|point) (?:to|in) (?:live|living|being alive)\b/,
  },
  // My plan maps (2026-10-23): what got in the way is written looking back ("I didn't want to be
  // alive", "I wished I was dead"). The past tense, without the present's "be here" and "wake
  // up", and "live" only on its own: not wanting to live in res is not a death wish.
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\b(?:didn't|did not) (?:want to|wanna) (?:be alive|exist|live)\b(?! (?:in|at|with|there|here|near|far|alone|on|off|by|like|for|without)\b)/,
  },
  // S1-A10b (A10-41): "be here" and "wake up" in the past tense are a death wish once "anymore" or
  // "again" says so ("I didn't want to be here anymore"), as is living "like this anymore";
  // "stopped wanting to live"; and the past of "can't go on", "can't see a future" and "end it".
  // Not wanting to wake up early, be here at UJ, go on the trip or see a future in a course is not.
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern: new RegExp(
      [
        "\\b(?:didn't|did not|never) (?:want(?:ed)? to|wanna) (?:be here any ?more\\b(?! than)|wake up (?:any ?more|ever again)\\b|wake up again(?= ?(?:$|[.!?,;])| (?:and|so|because)\\b)|live like this any ?more\\b)",
        '\\bstopped wanting to (?:be alive|exist|live)\\b(?! (?:in|at|with|there|here|near|far|alone|on|off|by|like|for|without)\\b)',
        "\\b(?:couldn't|could not) go on (?:any ?more|like this|living)\\b|\\b(?:couldn't|could not) go on(?= ?(?:$|[.!?]))",
        "\\b(?:didn't|did not|couldn't|could not) see (?:a|any) future(?: for (?:me|myself))?(?: any ?more)?(?= ?(?:$|[.!?,;])| (?:and|so|because|anymore)\\b)",
        `\\btried to end it\\b(?! (?:early|on|before|after|by|there|here|now|soon)\\b)${NOT_A_BREAKUP}`,
      ].join('|'),
    ),
  },
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\bgive up on (?:everything|life|living)\b|\bcan't go on\b|\bcannot go on\b|\boverdose\b/,
  },
  // Phase 4e: what a learner types after a bad trial or June result when it has crossed into
  // risk ("there's no point living", "what's the point of living", "id rather die"). "Life" never
  // means Life Orientation or Life Sciences here: those are subjects, and must not trigger.
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\b(?:no|what's the|whats the|what is the|see the|see any|any) (?:reason|point) (?:to |in |of )?(?:live|living|being alive|staying alive|life\b(?! orientation| science))/,
  },
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\b(?:i'd|id|i would) rather (?:die|be dead)\b|\bunalive\b|\b(?:done with|tired of|sick of) (?:life\b(?! orientation| science)|living|being alive)|\blife (?:is not|isn't|ain't|aint) worth (?:it|living)\b|\bnot worth living\b/,
  },
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\b(?:want to|wanna|wish i could|i hope i) (?:sleep and )?never wake up\b|\bsleep and never wake up\b|\bdisappear (?:forever|for good)\b/,
  },
  // Phase 5d, the first weeks at university: "I want to disappear" on its own, and "nobody would
  // notice if I was gone". Disappearing into bed for the weekend is not a death wish.
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\b(?:want(?:ed)? to|wanna|wish i could|going to|gonna) (?:just )?disappear\b(?! (?:in|into|to|for|from|under|with|until|till|off|on|at)\b| after (?:that|this|the|my|class|lectures?|exams?)\b)|\b(?:want(?:ed)? to|wanna|wish i could|going to|gonna) (?:just )?disappear (?:from (?:this |the )?(?:world|earth|face of the earth|everyone|everybody|existence)|off (?:the face of )?(?:the|this) (?:earth|planet|world)|into (?:nothing|nothingness))\b|\b(?:nobody|no one|noone) (?:would|will) (?:even )?(?:notice|care) if i (?:was|were|am) (?:gone|dead|not here)\b|\b(?:nobody|no one|noone) (?:would|will) (?:even )?(?:notice|care) if i (?:died|disappeared)\b/,
  },
  // Phase 5 audit (A10-17): methods named by place, substance or medicine, not a fixed phrase. A
  // method noun counts only with a verb of doing it to oneself, so "bleach to clean my room", "two
  // panados for my headache" and "jump off this call" stay ordinary talk.
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\bjump(?:ing|ed)? (?:off|from) (?:of )?(?:(?:a|the|this|that|my|our) )?(?:[a-z0-9']+ ){0,4}?(?:bridge|building|roof|rooftop|floor|balcony|cliff|window|tower)\b|\b(?:drink|drank|drinking|swallow|swallowed|swallowing) (?:the |some |a bottle of |a cup of |a glass of )?(?:bleach|jik|pesticide|paraffin)\b|\b(?:took|swallow|swallowed|downed) (?:all (?:of )?|a (?:bunch|lot|handful|box|bottle|pack|packet|strip) of |too many |loads of |lots of |the whole (?:box|bottle|pack|packet|strip) of |\d{2,} )(?:(?:my|the|his|her|their|[a-z]+'s) )?(?:[a-z]+ )?(?:pills|tablets|panados?|antidepressants?|painkillers?|meds|medication|medicine|paracetamol)\b|\boverdos(?:ed|ing)\b|\b(?:walk|walking|walked|step|stepping|stepped|run|running|ran|throw myself|throwing myself) (?:out )?into (?:the |oncoming )?traffic\b/,
  },
  // A10-17: indirect disclosures and plans. "Tonight is the night" counts only with farewell
  // letters or notes in the same message (proximity), so a res party does not.
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\b(?:want(?:ed)? to|wanna|wish i could|i'd like to|going to|gonna|i hope i) (?:just )?(?:go to )?sleep (?:forever|for ever|and (?:not|never) wake up)\b|\bsleep and not wake up\b|\b(?:want to|wanna|wish i could|i'd like to|going to|gonna|i'd rather|id rather|i would rather) (?:just )?(?:stop existing|not exist|cease to exist)\b|\b(?:can't|cannot) (?:live|keep living) like this\b|\bbetter off (?:if|when) i(?:'m| am| was| were)? (?:dead|gone|not here|not around|died|disappeared)\b|\bmy life is (?:over|finished|pointless|meaningless)\b|\bfarewell (?:letters?|notes?|messages?)\b|^(?=.*\b(?:wrote|written|writing|left|leaving)(?: [a-z']+){0,3} (?:letters?|notes?)\b)(?=.*\b(?:tonight|today) is the (?:night|day)\b)/,
  },
  // Phase 5 audit (A10-19; first-language review): stems, not phrases. Any prefix on the
  // first-person "want to die" (se-, -ya-, -sa-), "tired of life" with any concord (yi-, bu-, i-),
  // Sesotho "hwa", Setswana "lapisitswe", and the Afrikaans word order "my lewe neem". The
  // negative "angifuni ukufa" (I don't want to die) does not match: it is -funi, not -funa.
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\b\w*(?:ngi|ndi)(?:ya|sa)?funa ukufa\b|\b\w*khathele (?:yi|bu|i|ngu)?(?:mpilo|bomi)\b|\b\w*diniwe (?:bu|li|yi)?(?:bomi|mpilo)\b|\bke (?:a )?batla (?:ho|go) (?:shwa|hwa|swa)\b|\blap(?:ile|isitswe|isitse) ke (?:botshelo|bophelo)\b|\bmy (?:eie )?lewe (?:neem|beeindig)\b|\bwil nie meer (?:hier )?(?:wees|bestaan)\b/,
  },
  // isiZulu, isiXhosa, Sesotho, Setswana, Afrikaans (review with first-language speakers). Every
  // isiZulu and isiXhosa form of "kill oneself" shares the stem -zibulala (audit A10-03). Phase 5d
  // adds "I want to disappear" (isiZulu and isiXhosa ukunyamalala, Afrikaans verdwyn) and the
  // Afrikaans "nobody will miss me".
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\bngifuna ukufa\b|\b(?:ngi|ndi)funa ukunyamalala\b|\bek wil (?:net |maar )?verdwyn\b|\bniemand sal my (?:eers |eens )?mis\b|\b\w*zibulala\b|\bndifuna ukufa\b|\bke batla go swa\b|\bke batla ho shwa\b|\bek wil doodgaan\b|\bselfmoord\b|\bselfdood\b/,
  },
  // S1-A10b (A10-42), first-language review owed: the past tense. Afrikaans "ek wou (dood)gaan"
  // and "ek wou nie meer leef nie"; isiZulu and isiXhosa "I no longer wanted to live", any tense
  // prefix on -(nga)(sa)funi ukuphila; Sesotho and Setswana "ke ne ke sa batle ho/go phela".
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\bek wou (?:net |maar )?(?:dood|doodgaan|sterf)\b|\bek wou nie meer (?:leef|lewe|hier wees|bestaan)\b|\b\w*(?:ngi|ndi)(?:nga)?(?:sa)?funi ukuphila\b|\bne ke (?:sa )?batle? (?:ho|go) (?:phela|tshela)\b/,
  },
  // Phase 4e, same review: "I don't / no longer want to live" (isiZulu, isiXhosa, Sesotho,
  // Setswana, Afrikaans) and the Sotho-Tswana "kill oneself" (go/ho ipolaya). A10-03 adds "tired
  // of living" in each, and the Afrikaans "sterf" and "my lewe beëindig".
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\bangi(?:sa)?funi ukuphila\b|\bandi(?:sa)?funi ukuphila\b|\b(?:ha|ga) ke (?:sa )?batle? (?:ho|go) (?:phela|tshela)\b|\bipolaya\b|\bek wil nie meer (?:leef|lewe)\b|\bmyself doodmaak\b|\bek wil (?:net )?dood\b|\b\w*khathele (?:uku)?phila\b|\b\w*diniwe (?:uku|ku)?kuphila\b|\bkgathets?e ke bophelo\b|\blapile ke botshelo\b|\bwil (?:net )?sterf\b|\blewe beeindig\b/,
  },
  // Abuse and danger.
  { level: 'crisis', topics: ABUSE, pattern: /\brape\b/, topical: true },
  {
    level: 'crisis',
    topics: ABUSE,
    pattern: /\brap(?:ed|ing)\b|\bsexually (?:assaulted|abused)\b|\bmolest(?:ed|ing)?\b/,
  },
  {
    level: 'crisis',
    topics: ABUSE,
    pattern: new RegExp(
      `\\b${ABUSER} (?:hits?|beat(?:s|en)?|hurt(?:s)?|touch(?:es|ed)?|abus(?:es|ed)|threaten(?:s|ed)|rap(?:es|ed)|chok(?:es|ed)|strangl(?:es|ed)|slap(?:s|ped)|kick(?:s|ed)|burn(?:s|t|ed)) me\\b${NOT_SCHOOLWORK}`,
    ),
  },
  {
    level: 'crisis',
    topics: ABUSE,
    pattern:
      /\bforc(?:es|ed|ing) me to (?:sleep with|have sex)\b|\bmakes me (?:sleep with|have sex)\b/,
  },
  {
    level: 'crisis',
    topics: ABUSE,
    // "Not safe to drive" is not a disclosure (audit A10-07). "Not safe walking back to res at
    // night" is a safety question, a concern below (A10-21); "not safe going home" stays here.
    pattern:
      /\b(?:i'm|i am) (?:being )?(?:abused|beaten)\b|\b(?:i'm|i am) not safe\b(?! to | (?:walking|going|travel\w*|taking|getting)\b(?! (?:back )?home\b)| at night\b| on campus\b| alone at night\b)/,
  },
  // A threat of violence over results ("if I fail he will beat me"). "My mom will kill me if I
  // fail" is everyday hyperbole and is left to care, not crisis; a threat someone made or
  // repeated ("he threatened to kill me", "she said she will kill me") is not (audit A10-04).
  {
    level: 'crisis',
    topics: ABUSE,
    pattern: new RegExp(
      `\\b${ABUSER} (?:will|'ll|is going to|are going to|is gonna|gonna) (?:beat|hit|hurt) me\\b|\\b${ABUSER} (?:threatened to|threatens to|said (?:he|she|they)(?:'ll| will)) (?:beat|hit|hurt|kill) me\\b|\\b(?:he'll|she'll|they'll) (?:beat|hit|hurt) me\\b|\\bthreaten(?:s|ed) to (?:kill|beat|hurt) me\\b`,
    ),
  },
  // Phase 5 audit (A10-20): a threat in the present tense ("my boyfriend says he'll kill me").
  {
    level: 'crisis',
    topics: ABUSE,
    pattern: new RegExp(
      `\\b${ABUSER} (?:says|said|tells me|told me|keeps saying) (?:that )?(?:he|she|they)(?:'ll| will| is going to| are going to| is gonna| gonna| would) (?:kill|beat|hit|hurt|stab|rape) me\\b`,
    ),
  },
  // A10-20: sex demanded for marks, rent or a room (sextortion) by anyone with power over the
  // learner: a condition ("unless I sleep with him") with a power word in the same message, or
  // sex wanted in exchange. And unwanted touching by anyone, not only a listed relative.
  {
    level: 'crisis',
    topics: ABUSE,
    pattern:
      /^(?=.*\b(?:lecturers?|tutors?|professor|prof|landlord|landlady|supervisor|boss|manager|warden|house ?parent|fail me|pass me|marks?|grades?|results|rent|room|evict(?: me)?|kick me out|throw me out|bursary|funding|allowance)\b)(?=.*\b(?:unless|if|or else|or) i (?:don't |do not )?(?:sleep with (?:him|her|them)|have sex(?: with (?:him|her|them))?|hook up with (?:him|her|them)|go out with (?:him|her|them)|send (?:him|her|them) nudes)\b)|\bwants? (?:sex|to sleep with me|sexual favou?rs?)(?: from me)? (?:for|in exchange for|instead of)\b|\b(?:sex|sexual favou?rs?) (?:for|in exchange for) (?:marks|grades|rent|a room|the room|res|a place|my results|a pass)\b|\b(?:touched|touches|touching|grabbed|kissed|groped) me (?:without (?:my )?(?:consent|permission)|against my will|inappropriately)\b|\bgrop(?:ed|es|ing) me\b/,
  },
  // S1 audit (A10-27): self-harm in a younger learner's words. "I cut class again" and "the cat
  // keeps scratching my arms" are not: these need the learner as the one doing it.
  {
    level: 'crisis',
    topics: SUICIDE,
    pattern:
      /\bi (?:cut|cutted) (?:again|last night|tonight|today|yesterday)\b|\bi (?:[a-z']+ ){0,2}?scratch(?:ing|ed)? (?:my (?:arms?|legs?|wrists?|skin|thighs?|face)|myself) (?:until|till|til|to) (?:they|it|i) (?:bleed|bleeds|bled)\b|\bi (?:[a-z']+ ){0,2}?burn(?:ed|t|ing)? my (?:skin|arms?|legs?|wrists?|hands?|thighs?)\b/,
  },
  // A10-28: sexual exploitation of a child, online and off. Nudes shared, posted or demanded;
  // pictures asked for in secret; an adult demanding secrecy ("it's our secret", "you mustn't tell
  // your mom", but not a surprise party); unwanted touching by a stranger; sex for money or fees.
  {
    level: 'crisis',
    topics: ABUSE,
    pattern: new RegExp(
      [
        '\\b(?:shared|sharing|share|posted|posting|post|leaked|leaking|leak|spread|spreading|forwarded|sent around|asking for|asks for|asked for|wants|send (?:him|her|them)) (?:my |me |for |some |your )?(?:nudes?|naked (?:pics|pictures|photos))\\b',
        "^(?=.*\\b(?:send|sending|sent) (?:him |her |them |me )?(?:pics|pictures|photos|selfies|videos)\\b)(?=.*\\b(?:not|don't|do not|never|mustn't|must not) (?:to )?tell\\b)",
        "\\b(?:says|said|told me|tells me|keeps saying)(?: that)? (?:i )?(?:must not|mustn't|must never|can't|cannot|shouldn't|should not|not to|never) tell (?:anyone|anybody|my (?:mom|mum|mother|dad|father|parents|family|teacher|friends))\\b(?! about (?:the |a |my |our |your )?(?:surprise|party|gift|present|birthday|plan|marks|results))",
        "\\b(?:it's|it is|its|this is|that's) our (?:little )?secret\\b",
        "\\b(?:a|an|the|this|that|some) (?:taxi driver|driver|bus driver|security guard|guard|older man|old man|man|guy|stranger)\\b(?: [a-z']+){0,3}? (?:keeps |kept |always |still )?(?:touch(?:es|ed|ing)?|grab(?:s|bed|bing)?|follow(?:s|ed|ing)?) me\\b",
        "\\b(?:gives|give|gave|pays|pay|paid|buys|buy|bought)(?: me)? (?:[a-z']+ ){0,3}?(?:if|when|as long as) i (?:sleep with|have sex with|hook up with) (?:him|her|them)\\b",
      ].join('|'),
    ),
  },
  // A10-29: violence from other learners ("our team beat them up" is sport), against a parent or
  // a brother or sister at home ("beats my mom at chess" is a game), and neglect.
  {
    level: 'crisis',
    topics: ABUSE,
    pattern: new RegExp(
      [
        '\\b(?:boys|girls|kids|learners|students|guys|bullies|gangs?|gangsters)(?: (?:at|in|from) (?:school|class|res|my class|the area|my street))? (?:keep |keeps |always |still )?(?:beat(?:s)? me|beat me up|hit(?:s)? me|hitting me|attack(?:s|ed)? me|stab(?:bed)? me|jump(?:ed)? me)\\b',
        `\\b${ABUSER} (?:keeps |kept |always |still )?(?:touching|hitting|beating|hurting) me\\b`,
        `\\b${ABUSER} (?:hits|beats|beat|hurts|abuses|chokes|stabbed|kicks|slaps) my (?:little |big |baby |younger |older )?(?:mom|mum|mother|ma|sisters?|brothers?|siblings?|dad|father|granny|gogo)\\b(?! at\\b| in\\b)`,
        `\\b${ABUSER} (?:locks|locked|kicks|kicked|throws|threw) me (?:out|in)\\b(?! of\\b)`,
        "\\b(?:doesn't|does not|won't|will not|don't|refuses to|never) (?:give|let) me (?:any )?(?:food|eat)\\b(?! money)",
        "\\b(?:haven't|have not|didn't|did not) eat(?:en)? (?:in|for) (?:\\d+|two|three|four|five|a few|many) days\\b",
        '\\bno food (?:at|in the) (?:home|house)\\b',
      ].join('|'),
    ),
  },
  // Distress that isn't an emergency. "Lost on question 3" and "useless at physics" are study
  // talk (audit A10-08).
  {
    level: 'concern',
    topics: ['distress'],
    pattern:
      /\b(?:i'm|i am|i feel|i felt|feeling) (?:so |like |like such |such )?(?:(?:hopeless|worthless|a failure|failure|empty|alone|broken)\b|(?:useless|lost)\b(?! (?:on|about|with|at|in|for) ))|\bhate myself\b|\b(?:i'm|i am|i feel|i felt|feeling) (?:so |like |just |such )*(?:a |such a )?burden\b/,
  },
  // S1-A10b (A10-43): the same feelings with a word between ("I felt really hopeless"), a
  // reflection that starts "Felt…", "I was hopeless", "felt like nobody cared", "felt like dying"
  // (dyeing hair aside), and the Afrikaans (first-language review owed).
  {
    level: 'concern',
    topics: ['distress'],
    pattern: new RegExp(
      [
        "(?:\\b(?:i'm|i am|i feel|i felt|feeling|i was feeling|i've been feeling)|(?:^|[.!?;] )felt) (?:(?:so|really|very|completely|totally|just|kinda|pretty|extremely|truly|super|like) )+(?:hopeless|worthless|empty|alone|broken|a failure|a burden)\\b",
        '(?:^|[.!?;] )felt (?:hopeless|worthless|empty|alone|broken|like a (?:failure|burden))\\b',
        '\\bi was (?:(?:so|really|very|completely|totally|just) )*(?:hopeless|worthless|a burden)\\b',
        '\\b(?:feel|felt|feeling) like (?:nobody|no one|noone) (?:cared|cares|loved me|wanted me)\\b',
        '\\b(?:feel|felt|feeling) like dying\\b(?! (?:my|your|his|her|their|the) (?:hair|clothes|shirt|shoes|jeans)| laughing\\b| of laughter\\b)',
        '\\bek voel (?:so |baie )?(?:hopeloos|waardeloos)\\b|\\bek het (?:so |baie )?(?:hopeloos|waardeloos) gevoel\\b',
      ].join('|'),
    ),
  },
  {
    level: 'concern',
    topics: ['distress'],
    pattern:
      /\bdepress(?:ed|ion)\b|\bpanic attacks?\b|\bcan't (?:take|handle) it (?:any ?more)?\b|\bnobody cares\b|\bi give up\b(?! on (?:this|that|the|my|these) (?:questions?|sums?|problems?|homework|exercises?|tasks?|one|papers?)\b)|\bbreaking down\b|\bdone with everything\b|\bcan't (?:do this )?any ?more\b|\b(?:want|need) (?:it all|everything) to stop\b/,
  },
  // S1 audit (A10-30): bullying, in person or online, is a concern: the card (Childline) and a
  // check-in. A project about bullying is not.
  {
    level: 'concern',
    topics: ['distress', 'child'],
    pattern:
      /\bbull(?:y|ies|ied|ying) me\b|\b(?:being|getting|been|was|am|i'm) (?:cyber ?)?bullied\b|\bcyber ?bull(?:ies|ied|ying) me\b|\bmak(?:e|es|ing) fun of me\b/,
  },
  // Phase 5 audit (A10-17): warning signs, where the card and a check-in are right, not the protocol.
  {
    level: 'concern',
    topics: ['distress'],
    pattern:
      /\b(?:what's|whats|what is) the point of (?:anything|everything|it all)\b|\bno point (?:in|to|of) (?:anything|everything)\b|\b(?:not (?:gonna|going to)|won't|will not) be (?:here|around) (?:for )?much longer\b|\bgiv(?:e|ing|en) away (?:all )?(?:of )?my (?:stuff|things|belongings|possessions)\b/,
  },
  // A10-21: "not safe walking back to res at night" is a safety question. The card shows (with
  // campus security when it is verified), and the model answers it.
  {
    level: 'concern',
    topics: ['emergency', 'abuse'],
    pattern:
      /\b(?:i'm|i am|i feel|feel) (?:not safe|unsafe) (?:walking|going|travel\w*|taking|at night|on campus|on the way|getting|alone at night)\b/,
  },
  {
    level: 'concern',
    topics: ['substance', 'distress'],
    pattern:
      /\baddict(?:ed|ion)\b(?! to (?:coffee|tea|tiktok|netflix|anime|music|chocolate|games|gaming|my phone|social media|studying))|\bnyaope\b|\bwhoonga\b|\b(?:can't|couldn't|could not) stop (?:drinking|using|smoking)\b|\b(?:drink|drank|drinking|using|smoking) (?:every (?:day|night) )?to (?:forget|cope|numb)\b/,
  },
  // S1-A10b (A10-44): more of the ways it is written ("drank every weekend to forget", "smoked
  // weed to cope", "got drunk to forget"). A substance or a drinking verb is needed: "drinking
  // coffee to cope" and "used to cope by going to the gym" are not.
  {
    level: 'concern',
    topics: ['substance', 'distress'],
    pattern: new RegExp(
      [
        '\\b(?:drink|drank|drinking|got drunk|get drunk|getting drunk)(?: (?:alcohol|booze|beer|wine|a lot|so much|heavily|alone|every (?:day|night|weekend)|on weekends|at night))* to (?:forget|cope|numb)\\b',
        '\\b(?:smoke|smoked|smoking|use|used|using|take|took|taking)(?: (?:weed|dagga|drugs|alcohol|nyaope|tik|zol))+(?: (?:a lot|so much|alone|every (?:day|night|weekend)|on weekends|at night))* to (?:forget|cope|numb)\\b',
        '\\b(?:gedrink|drink|gerook) om (?:te )?vergeet\\b',
      ].join('|'),
    ),
  },
];

/**
 * A question about a set work. When the only crisis words are topical ones ("is suicide a theme
 * in Romeo and Juliet"), the learner still sees the helplines, but the model answers (audit
 * A10-07). Any first-person rule ("suicidal", "kill myself", "raped") keeps it a crisis.
 */
const LITERATURE =
  /\b(?:theme|themes|motif|novel|poem|poetry|setwork|set work|literature|shakespeare|playwright|to kill a mockingbird|romeo and juliet|macbeth|hamlet|othello|in the (?:book|play|story|novel|poem|film))\b/;

/**
 * "Academic suicide" and "is it suicide to register for 6 modules" are idioms about a workload
 * (audit A10-21). Like a literature question they soften only a topical word: the helplines still
 * show, the model answers, and any first-person rule keeps it a crisis.
 */
const IDIOM =
  /\b(?:academic|social|career|political|financial|gpa|registration) suicide\b|\b(?:is it|would it be|it's|it is|its|isn't it|that's|thats) (?:basically |pure |literally |just )?suicide to\b/;

/** What learners type on a phone keyboard: missing apostrophes, SMS spelling, typos (A10-01). */
const SHORTHAND: Readonly<Record<string, string>> = {
  cant: "can't",
  dont: "don't",
  dnt: "don't",
  im: "i'm",
  ive: "i've",
  wont: "won't",
  didnt: "didn't",
  doesnt: "doesn't",
  isnt: "isn't",
  wasnt: "wasn't",
  couldnt: "couldn't",
  wouldnt: "wouldn't",
  ima: "i'm going to",
  imma: "i'm going to",
  wnt: 'want',
  mustnt: "mustn't",
  wana: 'wanna',
  wnna: 'wanna',
  wanaa: 'wanna',
  dy: 'die',
  kil: 'kill',
  sucidal: 'suicidal',
  suicidel: 'suicidal',
  hasnt: "hasn't",
  havent: "haven't",
  disapear: 'disappear',
  dissapear: 'disappear',
  sucide: 'suicide',
  suiside: 'suicide',
  // S1-A10b (A10-41, A10-43).
  wishd: 'wished',
  hopless: 'hopeless',
  worthles: 'worthless',
};

/**
 * Lower case, accents and curly quotes straightened, spaced-out letters joined ("d i e"), and
 * phone shorthand expanded, so "I’m", "I'm" and "im" read the same.
 */
export function normaliseMessage(text: string): string {
  return expand(prepare(text));
}

function prepare(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\b(?:[a-z] ){2,}[a-z]\b/g, (letters) => letters.replace(/ /g, ''));
}

/**
 * SMS spellings and shorthand, and the misspellings of "myself" and "suicidal" read as families
 * rather than one listed form each (audit A10-18): "myslf", "myslef", "mysef"; "suicidial",
 * "sucicidal", "suicdal".
 */
function expand(prepared: string): string {
  return (
    prepared
      .replace(/\b2\b/g, 'to')
      // The apostrophe one letter late ("did'nt", "do'nt", "could'nt"): A10-41.
      .replace(/\b([a-z]+)'nt\b/g, "$1n't")
      .replace(/\b[a-z]+\b/g, (word) => SHORTHAND[word] ?? word)
      .replace(/\bm[yi]?s(?:lf|lef|ef|el|elf)\b/g, 'myself')
      .replace(/\bs+u+i*c+i*(?:c+i*)?d+(?:i*a+l+|e+l+|e+)\b/g, (word) =>
        word.endsWith('e') ? 'suicide' : 'suicidal',
      )
  );
}

const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
};

/**
 * The readings of a message the rules are tested against (audit A10-18): as typed, with a letter
 * held down collapsed ("wanttt to dieee"), and with digits read as letters inside a word ("k1ll
 * mys3lf"). A word of digits alone ("8 modules", "2") is left as it is.
 */
function readings(text: string): string[] {
  const base = prepare(text);
  const collapsed = base.replace(/([a-z])\1{2,}/g, '$1');
  const leet = (t: string) =>
    t.replace(/\b(?=[a-z0-9]*[a-z])(?=[a-z0-9]*[0-9])[a-z0-9]+\b/g, (word) =>
      word.replace(/[013457]/g, (d) => LEET[d] ?? d),
    );
  return [...new Set([base, collapsed, leet(base), leet(collapsed)].map(expand))];
}

/** A cue at the end of a sentence: "I'm done." is a farewell cue, "I'm done with maths" is not. */
const END = '(?= *(?:[.!?]|$))';

/**
 * Veiled farewells (Phase 6 audit, A10-64). Each alone is everyday talk ("I'm done.", "sorry
 * mama"), so two different cues together are the crisis; "I won't be here tomorrow." alone is a
 * warning sign, as "won't be here much longer" is (A10-17).
 */
const FAREWELL_CUES: ReadonlyArray<RegExp> = [
  new RegExp(`\\b(?:i'm|i am) (?:so |just |really )?done${END}`),
  new RegExp(`\\btonight is the night${END}`),
  /\bsorry (?:mama|mom|mum|ma|mommy|mummy|papa|dad|daddy|gogo|family|everyone|everybody)\b/,
  /\bthis is goodbye\b/,
];
const NOT_HERE = new RegExp(
  `\\b(?:i'm not going to|i won't|i will not) be here (?:tomorrow|anymore|any more)${END}`,
);
const FAREWELL: Rule = { level: 'crisis', topics: SUICIDE, pattern: NOT_HERE };
const WARNING_SIGN: Rule = { level: 'concern', topics: ['distress'], pattern: NOT_HERE };

function farewells(texts: ReadonlyArray<string>): Rule[] {
  const said = (pattern: RegExp) => texts.some((t) => pattern.test(t));
  const cues = FAREWELL_CUES.filter(said).length + (said(NOT_HERE) ? 1 : 0);
  if (cues >= 2) return [FAREWELL];
  return said(NOT_HERE) ? [WARNING_SIGN] : [];
}

export function assessDistress(text: string): DistressAssessment {
  const texts = readings(text);
  const matched = [
    ...RULES.filter((rule) => texts.some((t) => rule.pattern.test(t))),
    ...farewells(texts),
  ];
  if (matched.length === 0) return { level: 'none', topics: [] };
  const crisis = matched.filter((r) => r.level === 'crisis');
  const onlyTopical = crisis.length > 0 && crisis.every((r) => r.topical);
  const softened = texts.some((t) => LITERATURE.test(t) || IDIOM.test(t));
  const level = crisis.length === 0 || (onlyTopical && softened) ? 'concern' : 'crisis';
  const topics = [...new Set(matched.flatMap((r) => r.topics))];
  return { level, topics };
}

const RANK: Readonly<Record<DistressLevel, number>> = { none: 0, concern: 1, crisis: 2 };

/**
 * Learners split a sentence across bubbles ("i just want to" … "die"). The message is also read
 * with the learner's previous one, and that counts only when together they say something more
 * serious than either alone, so one crisis doesn't hold every later message in the protocol
 * (audit A10-06).
 */
export function assessWithPrevious(
  previous: string | undefined,
  message: string,
): DistressAssessment {
  const own = assessDistress(message);
  if (!previous) return own;
  const joined = assessDistress(`${previous} ${message}`);
  const before = assessDistress(previous);
  return RANK[joined.level] > Math.max(RANK[own.level], RANK[before.level]) ? joined : own;
}
