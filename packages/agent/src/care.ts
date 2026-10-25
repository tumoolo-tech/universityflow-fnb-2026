import { normaliseMessage } from './crisis';

/**
 * The hard moments of matric that are not a crisis (planning.md §3, Stage 3; §11, Phase 4e): exam
 * anxiety, a bad trial or June result, wanting to give up on the goal, comparing themselves to
 * others, and pressure from family. And of arriving at university (§3, Stages 4–5; §11, Phase 5d):
 * an offer that fell away after final results, money in January, homesickness and loneliness,
 * culture shock and first-generation pressure, and arrival anxiety and imposter feelings.
 *
 * A deterministic check, like the crisis one, on the learner's own words. It never decides an
 * answer: it tells the model which part of the charter's care guidance (`CARE_GUIDANCE`) applies,
 * so care comes first. The crisis check always runs before it, and wins: when a message crosses
 * into risk ("I failed my trial, there's no point living") the model is never reached at all.
 *
 * The phrases in isiZulu, isiXhosa, Sesotho, Setswana and Afrikaans are a starting set and must be
 * reviewed by first-language speakers before launch.
 */

export const CARE_TOPICS = [
  'setback',
  'offer-lost',
  'giving-up',
  'family-pressure',
  'comparison',
  'money-stress',
  'homesickness',
  'culture-shock',
  'arrival-anxiety',
  'exam-stress',
] as const;
export type CareTopic = (typeof CARE_TOPICS)[number];

const ASSESSMENT =
  '(?:trials?|prelims?|june|september|mid-?year|finals?|exams?|tests?|results?|reports?|papers?|marks?|maths|matric)';

const RULES: ReadonlyArray<{ readonly topic: CareTopic; readonly pattern: RegExp }> = [
  {
    topic: 'setback',
    pattern: new RegExp(
      [
        `\\b(?:fail(?:ed|ing|ure)?|flop(?:ped)?|bomb(?:ed)?|messed up|did (?:badly|bad|terribly|poorly)|didn't do well|didn't pass|got bad marks)\\b[^.!?]*\\b${ASSESSMENT}\\b`,
        `\\b${ASSESSMENT} (?:were|was|went|came out) (?:so |really )?(?:bad|badly|terrible|awful|horrible|low|a mess|dololo)\\b`,
        '\\bdololo\\b',
        // isiZulu, isiXhosa (I failed), Setswana (I was defeated by), Sesotho (I failed),
        // Afrikaans (failed): review with first-language speakers.
        '\\bngifeyile\\b|\\bndifeyile\\b|\\bpaletswe\\b|\\bhlolehile\\b|\\bgedruip\\b|\\bgesak\\b',
      ].join('|'),
    ),
  },
  {
    topic: 'offer-lost',
    pattern: new RegExp(
      [
        "\\boffers?\\b[^.!?]*\\b(?:withdrawn|withdrew|cancel(?:l)?ed|taken away|fell away|falls away|fallen away|fell through|revoked|rescinded|gone|lost|no longer valid|isn't valid|is not valid)\\b",
        '\\b(?:withdrew|cancel(?:l)?ed|took back|took away|revoked|rescinded|lost) (?:my|the|their) (?:offers?|place|spot|admission)\\b',
        "\\b(?:didn't|did not) get in after all\\b|\\b(?:didn't|did not) meet the conditions\\b",
        // A10-23: an admission cancelled or withdrawn; a university that didn't accept them.
        '\\badmission (?:is|was|has been|got) (?:cancel(?:l)?ed|withdrawn|revoked|rescinded)\\b',
        "\\b(?:didn't|did not|won't|will not) accept me\\b",
        // Afrikaans (my offer is gone, withdrawn): review with first-language speakers.
        '\\baanbod\\b[^.!?]*\\b(?:weg|teruggetrek|gekanselleer)\\b',
      ].join('|'),
    ),
  },
  {
    topic: 'giving-up',
    pattern:
      /\bgiv(?:e|ing) up\b|\bquit(?:ting)?\b|\bdrop(?:ping)? out\b|\bnever (?:get in|make it|qualify)\b|\b(?:no|what's the|whats the|what is the) point (?:of |in )?(?:even )?(?:studying|trying)\b|\bek gee op\b|\bngiyayeka\b|\bndiyayeka\b/,
  },
  {
    topic: 'family-pressure',
    pattern:
      /\b(?:parents?|mom|mum|mother|dad|father|family|gogo|granny|grandmother|grandma|aunt|aunty|auntie|uncle|guardian|people at home)\b[^.!?]*\b(?:disappointed|pressure|expect(?:s|ed|ing)?|angry|mad at me|shout(?:s|ed|ing)?|kill me|wants? me to|says? i (?:must|have to|should)|said i (?:must|have to|should)|forc(?:e|es|ed|ing)|disown)\b|\bpressure (?:from|at) (?:home|my family|my parents)\b/,
  },
  {
    topic: 'comparison',
    pattern:
      /\b(?:smarter|cleverer|better|brighter) than me\b|\bcompar(?:e|ing) myself\b|\bexcept me\b|\b(?:everyone|everybody|all my friends|my friends|my classmates|the whole class|my (?:brother|sister|cousin))\b[^.!?]*\b(?:passed|did (?:better|well)|(?:is|are) doing better|got (?:higher|better|more|distinctions?|level|7s?|a 7|sevens))\b/,
  },
  {
    topic: 'money-stress',
    pattern: new RegExp(
      [
        // NSFAS, or any funding by another name (A10-23: "my funding didn't come through").
        "\\b(?:nsfas|funding|bursary|bursaries|allowance|stipend)\\b[^.!?]*\\b(?:hasn't|has not|haven't|have not|didn't|did not|not|still|never|yet to)\\b[^.!?]*\\b(?:paid|pay|come|came|arrived|in|through)\\b",
        '\\b(?:nsfas|funding|bursary)\\b[^.!?]*\\b(?:delay(?:ed|s)?|late|stuck|rejected|declined)\\b',
        // isiZulu (I have no money for food): review with first-language speakers.
        '\\bangina(?:to)? mali\\b',
        "\\bno money\\b|\\b(?:can't|cannot|can not) afford\\b|\\b(?:i'm|i am|so|totally) broke\\b|\\bhungry\\b|\\bno food\\b|\\bnothing to eat\\b|\\bhaven't eaten\\b",
        "\\b(?:can't|cannot) (?:pay|buy) (?:for )?(?:food|fees?|rent|transport|taxi|the registration fee|registration|books|data)\\b",
        "\\b(?:fees?|rent|registration fee) (?:is|are) due\\b|\\ballowance\\b[^.!?]*\\b(?:late|hasn't|has not|didn't|did not|isn't|is not)\\b",
      ].join('|'),
    ),
  },
  {
    topic: 'homesickness',
    pattern: new RegExp(
      [
        '\\bhome ?sick(?:ness)?\\b|\\blonely\\b|\\bloneliness\\b|\\bno friends\\b',
        '\\bmiss(?:ing)? (?:home|my (?:family|mom|mum|ma|mother|dad|father|parents|gogo|granny|siblings|brothers?|sisters?|friends|people|home|village|town))\\b',
        "\\b(?:don't|do not) (?:know|have) (?:anyone|anybody|any friends|friends)\\b",
        '\\balone (?:at|in) (?:res|residence|varsity|university|uni|campus|this city)\\b',
        // isiZulu and isiXhosa (I miss home), Sesotho and Setswana (I miss home), Afrikaans
        // (homesickness, I miss my mother...): review with first-language speakers.
        '\\b\\w*khumbula e?khaya\\b|\\bhlolohetse hae\\b|\\btlhologeletswe gae\\b|\\bheimwee\\b|\\bverlang huis toe\\b',
        // isiXhosa and isiZulu (I am lonely, A10-23): review with first-language speakers.
        '\\b(?:ndi|ngi)nesizungu\\b',
        '\\bek mis my (?:ma|pa|mamma|pappa|familie|mense|ouma|oupa|huis|vriende)\\b',
      ].join('|'),
    ),
  },
  {
    topic: 'culture-shock',
    pattern:
      /\bculture shock\b|\b(?:don't|do not|can't|cannot) fit in\b|\bfirst (?:one |person )?in my family (?:to|at|who)\b|\bfirst[- ]generation\b|\b(?:my family|everyone at home|my parents|my people|home) (?:is|are) (?:all )?(?:counting|depending|relying) on me\b|\beveryone (?:here )?(?:is|seems) (?:so )?(?:rich|posh)\b/,
  },
  {
    topic: 'arrival-anxiety',
    pattern: new RegExp(
      [
        '\\b(?:scared|nervous|anxious|worried|afraid|terrified|freaking out|overwhelmed)\\b[^.!?]*\\b(?:res|residence|varsity|university|uni|campus|first[- ]year|o-?week|orientation|registration|lectures?|lecturers?|tutorials?)\\b',
        '\\b(?:res|residence|varsity|university|uni|campus|first[- ]year|o-?week|orientation|registration|lectures?)\\b[^.!?]*\\b(?:is|are) (?:killing me|so hard|too much|overwhelming|so scary|scary|stressing me)\\b',
        // A10-23: registration panic, in either order ("registration is a mess and i'm freaking
        // out", "wrong modules and im panicking"). A university moment, not matric exam stress.
        '\\b(?:registration|registering|modules?)\\b[^.!?]*\\b(?:panick?(?:ing|ed)?|freaking out|stress(?:ed|ing)|overwhelmed|a mess)\\b',
        '\\b(?:panick?(?:ing|ed)?|stress(?:ed|ing))\\b[^.!?]*\\b(?:registration|registering|modules?)\\b',
        '\\bwrong modules?\\b',
        "\\b(?:don't|do not) (?:belong|fit) (?:here|there|at (?:varsity|university|uni))\\b|\\bimpost[eo]r\\b|\\bnot (?:clever|smart|good) enough (?:for|to be at) (?:varsity|university|uni|here)\\b",
      ].join('|'),
    ),
  },
  {
    topic: 'exam-stress',
    pattern:
      // Afrikaans (stressed), Setswana and Sesotho (worried), isiZulu and isiXhosa (worried):
      // review with first-language speakers.
      /\bstress(?:ed|ing|ful)?\b|\banxi(?:ous|ety)\b|\bnervous\b|\bscared (?:of|about|for)\b|\bpanick?(?:ing|ed)?\b|\bfreaking out\b|\boverwhelmed\b|\bcan't sleep\b|\b(?:mind|head) (?:goes|went) blank\b|\bgestres\b|\btshwenyegile\b|\btshwenyehile\b|\bngikhathazekile\b|\bndixhalabile\b/,
  },
];

const NAMES_AN_ASSESSMENT = new RegExp(`\\b${ASSESSMENT}\\b`);

/**
 * The care topics a message raises, in `CARE_TOPICS` order (most specific first). A university
 * worry ("I'm scared of res", "registration is a mess and I'm panicking") is arrival anxiety, not
 * exam stress, whose guidance is about matric papers: exam stress goes with it only when the
 * message names an exam, a paper or a result (A10-23).
 */
export function assessCare(text: string): CareTopic[] {
  const normalised = normaliseMessage(text);
  const topics = RULES.filter((rule) => rule.pattern.test(normalised)).map((rule) => rule.topic);
  if (topics.includes('arrival-anxiety') && !NAMES_AN_ASSESSMENT.test(normalised)) {
    return topics.filter((t) => t !== 'exam-stress');
  }
  return topics;
}
