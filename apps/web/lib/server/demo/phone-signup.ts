import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isTollFreeNumber, maskPhone, normaliseTollFree } from '@universityflow/db';
import { cookies } from 'next/headers';
import { DEMO_080_ONLY, DEMO_080_TAKEN } from '../../demo-phone-signup';
import { HttpError } from '../http';
import type { Services } from '../services';
import { currentStudent } from '../session';
import { leaveCurrent, sweepOldCopies } from './core';

/**
 * The judge demo's on-screen phone sign-up (a HACKATHON EXCEPTION the owner approved on
 * 2026-10-24, lib/demo-phone-signup.ts, docs/deploy/demo.md): what the phone sign-in and guardian
 * routes do differently on a demo with `UF_DEMO_PHONE_SIGNUP=onscreen`. Nothing is sent: the PIN
 * and a guardian's link go back to the screen that asked. Only made-up toll-free numbers (080…);
 * the per-number and per-address limits stay. Neither the PIN, the link nor a number is ever
 * logged (hard rule 4). Outside a demo nothing here runs: the routes are as they were.
 */

/**
 * Whether this request is the demo's on-screen sign-up: false outside a demo (the route goes on
 * as before), true on a demo with the switch on, and not found (404) on a demo without it, so
 * turning the switch off restores the demo exactly.
 */
export function onScreenSignup(services: Services): boolean {
  if (!services.config.demo) return false;
  if (!services.config.demoPhoneSignup) throw new HttpError(404, 'not-found');
  return true;
}

/** A made-up toll-free number, or 400 `phone` with the detail that says to use one. */
export function requireTollFree(phone: string): void {
  if (!isTollFreeNumber(phone)) throw new HttpError(400, 'phone', DEMO_080_ONLY);
}

/**
 * A PIN for a made-up 080 number, returned for the screen that asked (never sent, never logged).
 * Sweeps the demo's old learners first, as a made-up learner's start does.
 */
export async function onScreenPin(
  services: Services,
  phone: string,
  ip: string | null,
): Promise<{ ok: true; phoneMasked: string; demoPin: string }> {
  requireTollFree(phone);
  await sweepOldCopies(services);
  await requireFreeOrOwn(services, phone);
  const challenge = await services.store.requestOtp(phone, { ip });
  // A demo has no store-review number (readConfig refuses UF_REVIEW_* there): nothing to show.
  if (challenge.review) throw new HttpError(404, 'not-found');
  return { ok: true, phoneMasked: maskPhone(challenge.phone), demoPin: challenge.code };
}

/**
 * The browser's demo learner before this sign-in, so the verify route can leave it once the new
 * one is signed in (a made-up learner's copy is deleted; a judge's own account only signed out of).
 */
export async function demoLearnerBefore(): Promise<string | null> {
  return (await currentStudent())?.studentId ?? null;
}

/** Leaves the browser's earlier demo learner when it isn't the one just signed in to. */
export async function leaveEarlier(
  services: Services,
  earlier: string | null,
  now: string,
): Promise<void> {
  if (earlier && earlier !== now) await leaveCurrent(services);
}

/**
 * The browser that made an 080 account (judges pick easy numbers, so two would otherwise land in
 * one account and see each other's details): an httpOnly cookie, demo only, holding a keyed hash
 * of the number (HMAC-SHA256 under AUTH_SECRET with its own label), never the number. It names
 * the last account this browser made, and lasts as long as the account does (24 hours).
 */
export const DEMO_PHONE_COOKIE = 'uf_demo_phone';
const OWNER_LABEL = 'uf-demo-phone-owner:v1:';
const DEMO_ACCOUNT_S = 24 * 60 * 60;

function ownerMark(services: Services, phone: string): string {
  return createHmac('sha256', services.config.authSecret)
    .update(`${OWNER_LABEL}${normaliseTollFree(phone)}`)
    .digest('hex');
}

/**
 * A number with no account yet, or one this browser made; otherwise 409 `phone` with the detail
 * that says it is taken (no PIN is issued or checked for it).
 */
export async function requireFreeOrOwn(services: Services, phone: string): Promise<void> {
  if (!(await services.store.demoPhoneHasAccount(phone))) return;
  const held = Buffer.from((await cookies()).get(DEMO_PHONE_COOKIE)?.value ?? '');
  const mine = Buffer.from(ownerMark(services, phone));
  if (held.length === mine.length && timingSafeEqual(held, mine)) return;
  throw new HttpError(409, 'phone', DEMO_080_TAKEN);
}

/** After a sign-in: marks this browser as the one that holds the number's account. */
export async function markOwner(
  services: Services,
  phone: string,
  request: Request,
): Promise<void> {
  const forwarded = request.headers.get('x-forwarded-proto');
  const https = (forwarded ?? new URL(request.url).protocol.replace(':', '')) === 'https';
  (await cookies()).set(DEMO_PHONE_COOKIE, ownerMark(services, phone), {
    httpOnly: true,
    secure: https || process.env['VERCEL_ENV'] === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: DEMO_ACCOUNT_S,
  });
}

/** A guardian's consent link, for the screen (the path only: it works on whatever host). */
export function consentLinkPath(token: string): string {
  return `/consent/${token}`;
}
