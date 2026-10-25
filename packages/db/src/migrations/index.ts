import { sql as init } from './0001_init';
import { sql as auditHardening } from './0002_audit_hardening';
import { sql as uploadsAndSmsBudget } from './0003_uploads_and_sms_budget';
import { sql as jobs } from './0004_jobs';
import { sql as messaging } from './0005_messaging';
import { sql as goalsAndExams } from './0006_goals_and_exams';
import { sql as rechecks } from './0007_rechecks';
import { sql as pushTokens } from './0008_push_tokens';
import { sql as adultConsent } from './0009_adult_consent';
import { sql as reviewAccount } from './0010_review_account';
import { sql as budgetUnits } from './0011_budget_units';
import { sql as reminderUnconfirmed } from './0012_reminder_unconfirmed';
import { sql as messagingSuppressions } from './0013_messaging_suppressions';
import { sql as consentGate } from './0014_consent_gate';
import { sql as pushTokenLimits } from './0015_push_token_limits';
import { sql as oneWaitingRecheck } from './0016_one_waiting_recheck';
import { sql as reminderBilledCategory } from './0017_reminder_billed_category';
import { sql as offers } from './0018_offers';
import { sql as firstWeek } from './0019_first_week';
import { sql as registrations } from './0020_registrations';
import { sql as universityDocumentsConsent } from './0021_university_documents_consent';
import { sql as foreignKeyIndexes } from './0022_foreign_key_indexes';
import { sql as registrationReminder } from './0023_registration_reminder';
import { sql as grade10Report } from './0024_grade_10_report';
import { sql as gradeGivenOn } from './0025_grade_given_on';
import { sql as replyReports } from './0026_reply_reports';
import { sql as gradeFloor } from './0027_grade_floor';
import { sql as profileLook } from './0028_profile_look';
import { sql as profilePhoto } from './0029_profile_photo';
import { sql as planMaps } from './0030_plan_maps';
import { sql as schoolRecordReports } from './0031_school_record_reports';
import { sql as storedFiles } from './0033_stored_files';
import { sql as demoSignups } from './0034_demo_signups';
import { sql as cv } from './0035_cv';
import { sql as replyWriters } from './0036_reply_writers';
import { sql as profilePhotoConsent } from './0037_profile_photo_consent';
import { sql as learnerRoleAndApiRoles } from './0038_learner_role_and_api_roles';
import { sql as cvReports } from './0039_cv_reports';
import { sql as moduleOutlines } from './0040_module_outlines';
import { sql as moduleMarks } from './0041_module_marks';

/** Every migration, in the order they run. Append only. */
export const MIGRATIONS: ReadonlyArray<{ id: string; sql: string }> = [
  { id: '0001_init', sql: init },
  { id: '0002_audit_hardening', sql: auditHardening },
  { id: '0003_uploads_and_sms_budget', sql: uploadsAndSmsBudget },
  { id: '0004_jobs', sql: jobs },
  { id: '0005_messaging', sql: messaging },
  { id: '0006_goals_and_exams', sql: goalsAndExams },
  { id: '0007_rechecks', sql: rechecks },
  { id: '0008_push_tokens', sql: pushTokens },
  { id: '0009_adult_consent', sql: adultConsent },
  { id: '0010_review_account', sql: reviewAccount },
  { id: '0011_budget_units', sql: budgetUnits },
  { id: '0012_reminder_unconfirmed', sql: reminderUnconfirmed },
  { id: '0013_messaging_suppressions', sql: messagingSuppressions },
  { id: '0014_consent_gate', sql: consentGate },
  { id: '0015_push_token_limits', sql: pushTokenLimits },
  { id: '0016_one_waiting_recheck', sql: oneWaitingRecheck },
  { id: '0017_reminder_billed_category', sql: reminderBilledCategory },
  { id: '0018_offers', sql: offers },
  { id: '0019_first_week', sql: firstWeek },
  { id: '0020_registrations', sql: registrations },
  { id: '0021_university_documents_consent', sql: universityDocumentsConsent },
  { id: '0022_foreign_key_indexes', sql: foreignKeyIndexes },
  { id: '0023_registration_reminder', sql: registrationReminder },
  { id: '0024_grade_10_report', sql: grade10Report },
  { id: '0025_grade_given_on', sql: gradeGivenOn },
  { id: '0026_reply_reports', sql: replyReports },
  { id: '0027_grade_floor', sql: gradeFloor },
  { id: '0028_profile_look', sql: profileLook },
  { id: '0029_profile_photo', sql: profilePhoto },
  { id: '0030_plan_maps', sql: planMaps },
  { id: '0031_school_record_reports', sql: schoolRecordReports },
  { id: '0033_stored_files', sql: storedFiles },
  { id: '0034_demo_signups', sql: demoSignups },
  { id: '0035_cv', sql: cv },
  { id: '0036_reply_writers', sql: replyWriters },
  { id: '0037_profile_photo_consent', sql: profilePhotoConsent },
  { id: '0038_learner_role_and_api_roles', sql: learnerRoleAndApiRoles },
  { id: '0039_cv_reports', sql: cvReports },
  { id: '0040_module_outlines', sql: moduleOutlines },
  { id: '0041_module_marks', sql: moduleMarks },
];
