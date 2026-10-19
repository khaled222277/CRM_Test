/**
 * Friendly aliases over the generated OpenAPI schema.
 *
 * `schema.ts` is generated from the running backend -- never edit it by hand.
 * Regenerate with `npm run generate:api` (see the README). Importing from here
 * rather than reaching into `components["schemas"][...]` everywhere means a
 * renamed backend model breaks in one file, not fifty.
 */
import type { components } from "./schema";

type Schemas = components["schemas"];

export type Token = Schemas["Token"];
export type UserOut = Schemas["UserOut"];
export type UserCreate = Schemas["UserCreate"];

export type ContactBrief = Schemas["ContactBrief"];
export type CompanyBrief = Schemas["CompanyBrief"];
export type ContactOut = Schemas["ContactOut"];
export type CompanyOut = Schemas["CompanyOut"];

export type DealOut = Schemas["DealOut"];
export type DealStage = Schemas["DealStage"];
export type PipelineStageSummary = Schemas["PipelineStageSummary"];

export type ActivityOut = Schemas["ActivityOut"];
export type ActivityType = Schemas["ActivityType"];

export type TaskOut = Schemas["TaskOut"];
export type TaskStatus = Schemas["TaskStatus"];

export type DashboardSummary = Schemas["DashboardSummary"];
export type DashboardTotals = Schemas["DashboardTotals"];
export type TaskCounts = Schemas["TaskCounts"];

/** Pipeline order, mirroring the backend enum. Used to lay out the chart. */
export const STAGE_ORDER = [
  "lead",
  "contacted",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const satisfies readonly DealStage[];

export const OPEN_STAGES: readonly DealStage[] = [
  "lead",
  "contacted",
  "proposal_sent",
  "negotiation",
];
