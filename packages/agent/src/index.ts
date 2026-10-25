/** The agent: charter, crisis protocol, tools, model adapters and the turn runner. Server-only. */
export type {
  ApplicationPackArtifact,
  Artifact,
  ArtifactKind,
  CampusTourArtifact,
  CourseExplorerArtifact,
  CrisisCampusLines,
  CrisisCardArtifact,
  DeadlinesArtifact,
  ExamCountdownArtifact,
  FirstWeekArtifact,
  FundingArtifact,
  GoalCardArtifact,
  MyModulesArtifact,
  OfferCardArtifact,
  OfferFinalCheck,
  PracticeArtifact,
  PracticeLink,
  PracticeReason,
  PracticeSubject,
  ResultsCardArtifact,
  SafetyNoteView,
  ScoreBreakdownArtifact,
  WhatINeedArtifact,
} from '@universityflow/ui';
export {
  acceptedUniversity,
  arrivalYear,
  campusSafetyLines,
  campusTour,
  campusUniversity,
  firstWeek,
  isUniversityId,
  needOf,
  type TickedStep,
} from './campus';
export { assessCare, CARE_TOPICS, type CareTopic } from './care';
export {
  CARE_GUIDANCE,
  CHARTER,
  type CharterPrincipleId,
  OFFER_GUIDANCE,
  SAFETY_ADVICE_GUIDANCE,
} from './charter';
export { type AgentContext, targetIntakeFor } from './context';
export {
  assessDistress,
  assessWithPrevious,
  type DistressAssessment,
  type DistressLevel,
  type DistressTopic,
  normaliseMessage,
} from './crisis';
export {
  GEMINI_API_BASE,
  GEMINI_DEFAULT_MODEL,
  GeminiChatModel,
  type GeminiChatModelOptions,
} from './gemini-model';
export { COUNTDOWN_LIMIT, type CountdownInput, examCountdown, goalCard } from './goals';
export {
  AnthropicChatModel,
  type ChatModel,
  type ChatTurn,
  FallbackChatModel,
  failedWriter,
  isModelUnavailable,
  MAX_TOOL_ROUNDS,
  ModelError,
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  ModelUnavailableError,
  NO_MODEL,
  type ReplyProvider,
  type ReplyWriter,
} from './model';
export {
  type AgentRegistration,
  explainDifference,
  moduleLabel,
  myModules,
  registeredModules,
  suggestedMessage,
} from './modules';
export {
  type AgentOffer,
  FINAL_RESULTS_KIND,
  type FinalResults,
  finalResultsFrom,
  offerCard,
} from './offers';
export { PRACTICE_SUBJECT_LIMIT, type PracticeInput, practicePlan } from './practice';
export { HISTORY_TURNS, runTurn, type TurnEvent, type TurnInput, type TurnResult } from './runner';
export {
  EMERGENCY_HELPLINE_IDS,
  SAFETY_ADVICE_RULES,
  safetyNoteViews,
  tourSafetyNotes,
} from './safety-notes';
export { SampleChatModel } from './sample-model';
export { requestContext, systemPrompt } from './system-prompt';
export {
  APPLICATION_CHECKLIST,
  CAMPUS_RULES,
  campusLinesFor,
  crisisCard,
  crisisReply,
  helplineCover,
  MODULE_RULES,
  OFFER_RULES,
  runTool,
  TOOLS,
  type Tool,
  ToolInputError,
  type ToolResult,
} from './tools';
