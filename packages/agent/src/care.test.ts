import { en } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import { assessCare, CARE_TOPICS } from './care';
import { CARE_GUIDANCE, CHARTER } from './charter';
import { assessDistress } from './crisis';
import { runTurn, type TurnEvent } from './runner';
import { SampleChatModel } from './sample-model';
import { requestContext, systemPrompt } from './system-prompt';
import { fakeContext, SAMPLE_MARKS, ScriptedModel } from './testing';

describe('assessCare: the hard moments of matric (Phase 4e)', () => {
  it.each([
    ['I failed my trial and I’m so stressed', ['setback', 'exam-stress']],
    ['my june marks were terrible', ['setback']],
    ['should i give up on medicine', ['giving-up']],
    ['everyone passed except me', ['comparison']],
    ['my gogo expects me to be a doctor', ['family-pressure']],
    ['im freaking out about paper 2', ['exam-stress']],
    ['What are the deadlines for Wits?', []],
    ['I want to study medicine at UCT', []],
  ] as const)('%s', (text, topics) => {
    expect(assessCare(text)).toEqual(topics);
  });

  it('is never a crisis on its own: care and the crisis protocol are separate checks', () => {
    for (const text of ['I failed my trial', 'exam anxiety is killing me', 'my mom will kill me']) {
      expect(assessDistress(text).level).toBe('none');
      expect(assessCare(text).length).toBeGreaterThan(0);
    }
  });
});

describe('CARE_GUIDANCE (the charter in hard moments)', () => {
  it('covers every care topic, exactly once', () => {
    expect(CARE_GUIDANCE.map((g) => g.topic).sort()).toEqual([...CARE_TOPICS].sort());
  });

  it('names only real charter principles', () => {
    const ids = new Set<string>(CHARTER.map((p) => p.id));
    for (const g of CARE_GUIDANCE) for (const p of g.principles) expect(ids.has(p)).toBe(true);
  });

  it('stays honest: no promised result, and points to what is still possible', () => {
    for (const g of CARE_GUIDANCE) {
      expect(g.guidance).not.toMatch(/you will (pass|get in|be accepted)|guarantee/i);
    }
    const setback = CARE_GUIDANCE.find((g) => g.topic === 'setback')?.guidance ?? '';
    expect(setback).toMatch(/what_i_need/);
    expect(setback).toMatch(/Plan B/);
    expect(setback).toMatch(/practice_for/);
    expect(setback).toMatch(/Never promise/);
  });

  it('escalates to the crisis card when giving up or pressure turns into risk', () => {
    const text = (topic: string) => CARE_GUIDANCE.find((g) => g.topic === topic)?.guidance ?? '';
    expect(text('giving-up')).toMatch(/crisis_card/);
    expect(text('family-pressure')).toMatch(/crisis_card/);
  });

  // Audit A10-09 and A10-10: pressure can be a threat, and a helpline means the verified card.
  it('never assumes family pressure is well meant, and treats a threat as a crisis', () => {
    const text = (topic: string) => CARE_GUIDANCE.find((g) => g.topic === topic)?.guidance ?? '';
    expect(text('family-pressure')).not.toMatch(/wanting the best/);
    expect(text('family-pressure')).toMatch(/threat/);
    for (const { guidance } of CARE_GUIDANCE) {
      if (/helpline/.test(guidance)) expect(guidance).toMatch(/crisis_card/);
    }
  });

  it('never compares the learner to anyone (never-shame)', () => {
    const comparison = CARE_GUIDANCE.find((g) => g.topic === 'comparison');
    expect(comparison?.principles).toContain('never-shame');
    expect(comparison?.guidance).toMatch(/never compare/i);
  });
});

describe('assessCare: arriving at university (Phase 5d)', () => {
  it.each([
    // A university worry is not exam stress: no matric paper is named (A10-23).
    ["I'm scared of res", ['arrival-anxiety']],
    ['registration is killing me', ['arrival-anxiety']],
    ["i feel like i don't belong here, everyone is so clever", ['arrival-anxiety']],
    ["I'm homesick", ['homesickness']],
    ["i don't know anyone at res and i'm lonely", ['homesickness']],
    ["nsfas hasn't paid and i have no money for food", ['money-stress']],
    ['nsfas hasnt paid yet', ['money-stress']],
    ['my offer was withdrawn after my final results', ['offer-lost']],
    ["i'm the first in my family to go to university", ['culture-shock']],
    ['culture shock is real here', ['culture-shock']],
    // Excitement, slang and plain questions are not hard moments.
    ["I'm dying to get my student card", []],
    ['this queue is murder', []],
    ['my phone broke during registration', []],
    ['How does NSFAS pay for books?', []],
    ['Is my offer from Wits provisional?', []],
  ] as const)('%s', (text, topics) => {
    expect(assessCare(text)).toEqual(topics);
  });
});

// Audit A10-23: everyday forms of the arrival moments the first set missed.
describe('assessCare: the everyday forms A10-23 found', () => {
  it.each([
    // Money: funding or a bursary, not only NSFAS by name.
    ["my funding didn't come through", ['money-stress']],
    ["my bursary hasn't paid", ['money-stress']],
    ['the bursary still has not paid my residence fees', ['money-stress']],
    // An offer or an admission lost, in the words learners use.
    ["uct didn't accept me after my finals", ['offer-lost']],
    ['my admission is cancelled', ['offer-lost']],
    ['my provisional offer is no longer valid', ['offer-lost']],
    // Registration panic is a university moment, never exam stress (whose guidance is matric's).
    ["registration is a mess and i'm freaking out", ['arrival-anxiety']],
    ['wrong modules and im panicking', ['arrival-anxiety']],
    ["i'm panicking about my modules", ['arrival-anxiety']],
    // First-language money and loneliness phrases: review with first-language speakers.
    ['angina mali yokudla', ['money-stress']],
    ['ndinesizungu apha eres', ['homesickness']],
    // Controls: still exam stress when a paper is named; plain questions are not hard moments.
    ["i'm panicking about maths paper 2", ['exam-stress']],
    ['how do i check my modules?', []],
    ['when does my bursary pay?', []],
    ['is my admission letter final?', []],
  ] as const)('%s', (text, topics) => {
    expect(assessCare(text)).toEqual(topics);
  });

  it('exam stress guidance is for matric papers; arrival guidance covers a registration gone wrong', () => {
    const text = (topic: string) => CARE_GUIDANCE.find((g) => g.topic === topic)?.guidance ?? '';
    expect(text('exam-stress')).toMatch(/matric/);
    expect(text('arrival-anxiety')).toMatch(/compare_registration/);
    expect(text('arrival-anxiety')).toMatch(/registration/);
  });
});

describe('CARE_GUIDANCE in the first weeks at university (Phase 5d)', () => {
  const text = (topic: string) => CARE_GUIDANCE.find((g) => g.topic === topic)?.guidance ?? '';
  const ARRIVAL = [
    'offer-lost',
    'money-stress',
    'homesickness',
    'culture-shock',
    'arrival-anxiety',
  ] as const;

  it('puts care first in every arrival moment', () => {
    for (const topic of ARRIVAL) {
      expect(CARE_GUIDANCE.find((g) => g.topic === topic)?.principles, topic).toContain(
        'considerate-first',
      );
    }
  });

  it('an offer that fell away: care, then Plan B, never "you failed", never final unless it is', () => {
    expect(text('offer-lost')).toMatch(/care first/i);
    expect(text('offer-lost')).toMatch(/Plan B/);
    expect(text('offer-lost')).toMatch(/never say or imply they failed/i);
    expect(text('offer-lost')).toMatch(/never say an offer is final/i);
    expect(text('offer-lost')).toMatch(/\boffers\b/);
    expect(text('offer-lost')).toMatch(/crisis_card/);
  });

  it('money in January: points to financial aid and food support, never promises funding', () => {
    expect(text('money-stress')).toMatch(/funding_overview/);
    expect(text('money-stress')).toMatch(/financial aid/);
    expect(text('money-stress')).toMatch(/food support/);
    expect(text('money-stress')).toMatch(/Never promise that NSFAS/);
    expect(text('money-stress')).toMatch(/crisis_card/);
  });

  // The campus counselling place is a safety fact: only its verified record, from a tool.
  it('refers warmly to campus counselling, with details only from a tool, never from memory', () => {
    for (const topic of ['homesickness', 'arrival-anxiety'] as const) {
      expect(text(topic)).toMatch(/counselling/);
      expect(text(topic)).toMatch(/never (?:a name or )?(?:a )?number from memory/i);
      expect(text(topic)).toMatch(/crisis_card/);
    }
  });

  it('carries no phone number, amount or date of its own', () => {
    for (const topic of ARRIVAL) {
      expect(text(topic)).not.toMatch(/\d/);
      expect(text(topic)).not.toMatch(/you will (pass|get in|be accepted|be funded)|guarantee/i);
    }
  });

  it('never compares the learner to other students (never-shame)', () => {
    expect(CARE_GUIDANCE.find((g) => g.topic === 'culture-shock')?.principles).toContain(
      'never-shame',
    );
    expect(text('culture-shock')).toMatch(/never compare/i);
  });

  it('the prompt forbids a campus number from memory, as it does a helpline', () => {
    expect(systemPrompt()).toMatch(/campus phone number/);
  });
});

describe('the system prompt and context carry the care guidance', () => {
  it('has every topic’s guidance, and still no admission fact', () => {
    const prompt = systemPrompt();
    expect(prompt).toMatch(/Hard moments/);
    for (const g of CARE_GUIDANCE) expect(prompt).toContain(g.guidance);
    expect(prompt).toMatch(/practice_for/);
    expect(prompt).not.toMatch(/\bAPS (of )?\d|\d{2}%|R\d{2,}/);
  });

  it('names the hard moment in the request context only when there is one', () => {
    const base = {
      today: new Date('2026-10-13T00:00:00Z'),
      targetIntake: 2028,
      grade: 11,
      displayName: null,
      goal: null,
      preview: false,
      concern: false,
    };
    expect(requestContext({ ...base, care: ['setback'] })).toMatch(/hard moment \(setback\)/);
    expect(requestContext({ ...base, care: [] })).not.toMatch(/hard moment/);
    expect(requestContext(base)).not.toMatch(/hard moment/);
  });
});

async function turn(message: string, model = new ScriptedModel([{ say: 'ok' }])) {
  const fake = fakeContext({ marks: SAMPLE_MARKS });
  const events: TurnEvent[] = [];
  const result = await runTurn({
    model,
    context: fake.context,
    history: [],
    message,
    emit: (e) => events.push(e),
  });
  return { result, model, fake };
}

describe('the turn runner and hard moments', () => {
  it('tells the model to answer a failed trial with care, without a crisis card', async () => {
    const { result, model } = await turn('I failed my trial and I’m so stressed');
    expect(result.distress).toBe('none');
    expect(result.care).toEqual(['setback', 'exam-stress']);
    expect(result.artifacts.some((a) => a.kind === 'crisis-card')).toBe(false);
    expect(model.requests[0]?.context).toMatch(/Hard moments guidance/);
  });

  it('never reaches the model when the same moment crosses into risk', async () => {
    const { result, model } = await turn('I failed my trial, there’s no point living');
    expect(result.distress).toBe('crisis');
    expect(result.care).toEqual([]);
    expect(model.requests).toHaveLength(0);
    expect(result.text).toBe(en.crisis.reply);
  });
});

describe('the sample model in hard moments (local development)', () => {
  it.each([
    ['I failed my trial', 'setback'],
    ['i want to give up on my goal', 'giving-up'],
    ['my parents expect too much from me', 'family-pressure'],
    ['everyone is smarter than me', 'comparison'],
    ['I am so stressed about exams', 'exam-stress'],
    ['my offer was withdrawn after my final results', 'offer-lost'],
    ["nsfas hasn't paid and i have no money for food", 'money-stress'],
    ["I'm homesick", 'homesickness'],
    ['culture shock is real here', 'culture-shock'],
    ["I'm scared of res", 'arrival-anxiety'],
  ] as const)('%s → care, from packages/content', async (text, topic) => {
    const { result } = await turn(text, new SampleChatModel() as never);
    expect(result.text).toBe(en.agent.sample.care[topic]);
    expect(result.text).not.toMatch(/you will (pass|get in)|guarantee/i);
  });

  // Phase 5d, charter: the fixed care words never call an offer final, never promise money, never
  // say "you failed", and never carry a phone number (a campus number comes only from a tool).
  it('keeps the arrival care words honest', () => {
    const c = en.agent.sample.care;
    for (const words of [
      c['offer-lost'],
      c['money-stress'],
      c.homesickness,
      c['culture-shock'],
      c['arrival-anxiety'],
    ]) {
      expect(words).not.toMatch(/\d/);
      expect(words).not.toMatch(/you(?:'|’)re in\b|your offer is final|you failed/i);
      expect(words).not.toMatch(/NSFAS will (?:pay|fund)|you will (?:get|be) (?:paid|funded)/i);
    }
    expect(c['offer-lost']).toMatch(/Plan B/);
  });

  // Audit A10-16, in line with A10-09: the fixed words for family pressure never say why the
  // family is pushing, or that it is well meant; pressure can be a threat. They ask instead.
  it('family pressure: never assumes good intent, and asks how things are at home', () => {
    const words = en.agent.sample.care['family-pressure'];
    expect(words).not.toMatch(
      /wanting the best|want(?:s)? the best|means? well|mean well|loves? you|cares? about you|for your own good|good intentions?/i,
    );
    expect(words).toMatch(/\?/);
    expect(words).toMatch(/home/);
  });

  it('with money stress, shows how NSFAS works, from the tool, with the care', async () => {
    const { result } = await turn(
      "nsfas hasn't paid and i have no money for food",
      new SampleChatModel() as never,
    );
    expect(result.text).toBe(en.agent.sample.care['money-stress']);
    expect(result.artifacts.map((a) => a.kind)).toEqual(['funding']);
  });

  it('after a failed trial, shows free practice for what matters', async () => {
    const { result } = await turn('I failed my trial', new SampleChatModel() as never);
    expect(result.artifacts.map((a) => a.kind)).toEqual(['practice']);
  });

  it('answers a practice question with the practice panel', async () => {
    const { result } = await turn('what should i practise?', new SampleChatModel() as never);
    expect(result.artifacts.map((a) => a.kind)).toEqual(['practice']);
    expect(result.text).toMatch(/free practice/);
  });

  it('says plainly when it has nothing to choose practice from', async () => {
    const fake = fakeContext({ marks: null });
    const result = await runTurn({
      model: new SampleChatModel(),
      context: fake.context,
      history: [],
      message: 'can you give me practice?',
      emit: () => undefined,
    });
    expect(result.text).toBe(en.agent.sample.noPractice);
    expect(result.artifacts).toEqual([]);
  });
});
