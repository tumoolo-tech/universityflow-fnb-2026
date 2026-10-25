import { en } from '@universityflow/content';
import { assessCare } from './care';
import type { ChatModel, ModelRequest, ModelResponse, ReplyWriter } from './model';

/**
 * The local stand-in for the language model (D8). It recognises a few kinds of question by
 * keyword, calls the same tools the real model would, and answers from fixed sentences in
 * packages/content. It is honest about being a script (the interface says so) and is refused in
 * production. Its job is to let the whole chat, every tool and every artifact be built and
 * tested end to end without an API key.
 */

const UNIVERSITIES: ReadonlyArray<readonly [string, RegExp]> = [
  ['wits', /\bwits\b|witwatersrand/],
  ['uj', /\buj\b|johannesburg/],
  ['up', /\bup\b|\btuks\b|pretoria/],
  ['uct', /\buct\b|cape town/],
  ['tut', /\btut\b|tshwane/],
  ['ukzn', /\bukzn\b|kwazulu|\bcao\b/],
];

function universityIn(text: string): string | null {
  return UNIVERSITIES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

const say = (request: ModelRequest, text: string): ModelResponse => {
  request.onText(text);
  return { text, refused: false };
};

export class SampleChatModel implements ChatModel {
  readonly isSample = true;
  /** The local script, no AI at all (A10-49). */
  readonly writer: ReplyWriter = { provider: 'local', model: 'sample-chat-model' };

  async respond(request: ModelRequest): Promise<ModelResponse> {
    const last = request.history.at(-1)?.text.toLowerCase() ?? '';
    const s = en.agent.sample;

    if (/\bremember\b/.test(last)) {
      const body = last.replace(/^.*?\bremember( that)?\b/, '').trim();
      if (body.length >= 2) {
        await request.callTool('remember', { kind: 'note', body: body.slice(0, 280) });
        return say(request, s.remembered);
      }
    }

    // A hard moment comes before any coaching (planning.md §3, Stage 3). The crisis protocol
    // has already answered, without reaching any model, if the message crossed into risk.
    const [care] = assessCare(last);
    if (care) {
      if (care === 'setback' || care === 'giving-up') {
        // Care first, then something real to do next: practice for what matters.
        await request.callTool('practice_for', {});
      }
      // An offer that fell away: the offer cards carry the final-results check and Plan B.
      if (care === 'offer-lost') await request.callTool('offers', {});
      // Money in January: how NSFAS works and what to follow up, never a promise it will pay.
      if (care === 'money-stress') await request.callTool('funding_overview', {});
      return say(request, s.care[care]);
    }

    if (
      /\bgot in\b|\bgot (an? )?offers?\b|\bmy offers?\b|\boffer letter\b|acceptance letter|\bgot accepted\b|\bprovisional(ly)?\b/.test(
        last,
      )
    ) {
      const result = await request.callTool('offers', {});
      const facts = JSON.parse(result.content) as { count?: number };
      return say(request, facts.count ? s.offers(facts.count) : s.noOffers);
    }

    if (/\bfirst[- ]week\b|\borientation\b|\bstudent card\b/.test(last)) {
      const university = universityIn(last);
      const result = await request.callTool(
        'first_week',
        university ? { university_id: university } : {},
      );
      const facts = JSON.parse(result.content) as { status?: string };
      return say(request, facts.status === 'no-university' ? s.campusAsk : s.firstWeek);
    }

    if (/\bcampus\b|campus tour|\bwhere is the\b/.test(last)) {
      const university = universityIn(last);
      const result = await request.callTool(
        'campus_tour',
        university ? { university_id: university } : {},
      );
      const facts = JSON.parse(result.content) as { status?: string };
      return say(request, facts.status === 'no-university' ? s.campusAsk : s.campus);
    }

    if (
      /\bmy modules\b|\bmodules?\b.*\bregist|\bregist(ered|ration)\b.*\bmodules?\b|proof of registration|registration check/.test(
        last,
      )
    ) {
      const result = await request.callTool('compare_registration', {});
      const facts = JSON.parse(result.content) as { status?: string; differences?: unknown[] };
      if (facts.status === 'no-registration') return say(request, s.noRegistration);
      if (facts.status !== 'checked') return say(request, s.modulesNoCurriculum);
      return say(request, s.modules(facts.differences?.length ?? 0));
    }

    if (/practi[cs]e|revis|siyavula|textbook|study material/.test(last)) {
      const result = await request.callTool('practice_for', {});
      const facts = JSON.parse(result.content) as { subjects?: unknown[] };
      const n = facts.subjects?.length ?? 0;
      return say(request, n > 0 ? s.practice(n) : s.noPractice);
    }

    if (/\bexams?\b|\bpapers?\b|timetable|countdown/.test(last)) {
      const result = await request.callTool('exam_countdown', {});
      const facts = JSON.parse(result.content) as { papers?: unknown[] };
      const n = facts.papers?.length ?? 0;
      return say(request, n > 0 ? s.exams(n) : s.noExams);
    }

    if (/\bgoal\b|aiming for|target/.test(last)) {
      const result = await request.callTool('show_goal', {});
      const facts = JSON.parse(result.content) as { status?: string; programme?: string };
      return say(request, facts.programme ? s.goal(facts.programme) : s.noGoal);
    }

    if (/nsfas|fund|bursar|money|afford|fees?\b/.test(last)) {
      await request.callTool('funding_overview', {});
      return say(request, s.funding);
    }

    const university = universityIn(last);
    if (university && /need|apply|pack|document|checklist|how do i/.test(last)) {
      await request.callTool('application_pack', { university_id: university });
      return say(request, s.pack(university.toUpperCase()));
    }

    if (/deadline|close|closing|open|when/.test(last)) {
      await request.callTool('deadlines', university ? { university_ids: [university] } : {});
      return say(request, s.deadlines);
    }

    if (/qualif|study|course|programme|marks?|results?|aps|score|apply for|options/.test(last)) {
      const result = await request.callTool('my_results', {});
      const facts = JSON.parse(result.content) as {
        status?: string;
        qualify_now?: { count: number };
        on_track?: { count: number };
        close?: { count: number };
        plan_b?: { count: number };
      };
      if (facts.status === 'no-confirmed-report' || !facts.qualify_now) {
        return say(request, s.noReport);
      }
      // Grade 10 marks (G10-3): on track, never "the minimums for 0 degrees" (A10-37).
      if (facts.on_track) {
        return say(request, s.resultsGrade10(facts.on_track.count, facts.close?.count ?? 0));
      }
      return say(
        request,
        s.results(facts.qualify_now.count, facts.close?.count ?? 0, facts.plan_b?.count ?? 0),
      );
    }

    if (/^(hi|hello|hey|sawubona|dumela|molo|howzit)\b/.test(last)) return say(request, s.greeting);
    return say(request, s.fallback);
  }
}
