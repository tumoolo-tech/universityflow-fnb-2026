import { describe, expect, it } from 'vitest';
import { en } from './en';
import { OWNER_TO_FILL, ownerToFillFields, privacyPage } from './en/privacy-page';

/**
 * The privacy policy template (/privacy) and the ECTA s43 footer: the words the owner and their
 * legal adviser complete. Every field the launch standard names must exist, and while it is not
 * filled in it must say so ("Owner to fill"), never a made-up value.
 */

/** ECTA s43(1): what the footer of every public page shows. */
const ECTA_FIELDS = [
  'legalName',
  'legalStatus',
  'registrationNumber',
  'physicalAddress',
  'phone',
  'email',
] as const;

describe('privacyPage', () => {
  it('is wired into en, appended after the sections before it', () => {
    expect(en.privacyPage).toBe(privacyPage);
    // Appended, never reordered: it comes straight after `agent`, the last section before it.
    // Later sections may follow it.
    const keys = Object.keys(en);
    expect(keys.indexOf('privacyPage')).toBe(keys.indexOf('agent') + 1);
  });

  it('has every ECTA s43 field, each with a label', () => {
    for (const field of ECTA_FIELDS) {
      expect(privacyPage.business[field], field).toMatch(/\S/);
      expect(privacyPage.businessLabels[field], field).toMatch(/\S/);
    }
    expect(Object.keys(privacyPage.business).sort()).toEqual([...ECTA_FIELDS].sort());
  });

  it('has every field the launch standard needs the owner to give', () => {
    const s = privacyPage.sections;
    const fields = {
      updated: privacyPage.updated,
      officerName: s.officer.values.name,
      officerEmail: s.officer.values.email,
      officerPhone: s.officer.values.phone,
      retentionSchedule: s.keep.schedule,
      smsProvider: s.operators.items.find((o) => o.id === 'sms')?.name,
      whatsappPartner: s.operators.items.find((o) => o.id === 'meta')?.partner,
      jobs: s.operators.items.find((o) => o.id === 'jobs')?.name,
      paiaManual: s.rights.paiaManual,
    };
    for (const [name, value] of Object.entries(fields)) expect(value, name).toMatch(/\S/);
  });

  it('lists every field still marked "Owner to fill", once each', () => {
    const fields = ownerToFillFields();
    const unfilled = Object.values(privacyPage.business).filter((v) => v.startsWith(OWNER_TO_FILL));
    expect(fields).toEqual(expect.arrayContaining(unfilled));
    expect(fields.every((f) => f.startsWith(`${OWNER_TO_FILL}:`))).toBe(true);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it('says plainly that it is a template for legal review', () => {
    expect(privacyPage.templateTitle).toMatch(/template/i);
    expect(privacyPage.templateNotice).toMatch(/legal adviser/);
    expect(privacyPage.templateNotice).toContain(OWNER_TO_FILL);
  });

  it('names every operator by id, once', () => {
    const ids = privacyPage.sections.operators.items.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'aws',
        'vercel',
        'anthropic',
        'sms',
        'meta',
        'push',
        'elevenlabs',
        'jobs',
        'email',
        'spam',
      ]),
    );
  });

  it('keeps ElevenLabs to public text, and off for learners until its under-18 approval', () => {
    const eleven = privacyPage.sections.operators.items.find((o) => o.id === 'elevenlabs');
    expect(eleven?.gets).toMatch(/public/i);
    expect(eleven?.gets).toMatch(/never anything about you/i);
    expect(eleven?.note).toMatch(/under 18/);
  });

  it('names the IP address and why it is used', () => {
    expect(privacyPage.sections.collect.items.join(' ')).toMatch(/IP address/);
  });

  it('mentions the profile photo and a plan map’s own words only as switched on later, after consent v4', () => {
    const later = privacyPage.sections.later.items.join(' ');
    expect(later).toMatch(/photo/i);
    expect(later).toMatch(/own words in a plan map/i);
    // The rest of a plan map is collected today (A11-34).
    expect(privacyPage.sections.collect.items.join(' ')).toMatch(/Plan maps you make/);
    expect(privacyPage.sections.later.lead).toMatch(/switched on/);
    expect(privacyPage.sections.later.lead).toMatch(/new consent/);
  });

  it('gives the consent boxes their link wording', () => {
    expect(privacyPage.consentLink).toMatch(/privacy policy/i);
    expect(privacyPage.adultConfirm).toMatch(/agree/i);
  });
});
