import type { DealStage } from "@/api/types";

/**
 * Single source of truth for how a stage looks.
 *
 * The dashboard's pipeline chart and every StageBadge read from here, so a
 * stage can never be teal in one view and green in another.
 *
 * Colour is semantic, not decorative: accent for stages still in play, a muted
 * green for won, plain grey for lost.
 */

export type StageTone = "accent" | "positive" | "neutral";

const STAGE_TONES: Record<DealStage, StageTone> = {
  lead: "accent",
  contacted: "accent",
  proposal_sent: "accent",
  negotiation: "accent",
  won: "positive",
  lost: "neutral",
};

export function stageTone(stage: DealStage): StageTone {
  return STAGE_TONES[stage] ?? "accent";
}

/** Bar fill for the dashboard pipeline chart. */
const BAR_CLASSES: Record<StageTone, string> = {
  accent: "bg-accent-500",
  positive: "bg-positive-600",
  neutral: "bg-ink-300",
};

export function stageBarClass(stage: DealStage): string {
  return BAR_CLASSES[stageTone(stage)];
}

export const TERMINAL_STAGES: readonly DealStage[] = ["won", "lost"];

/** Terminal deals cannot leave their stage -- the backend rejects it with a 400. */
export function isTerminalStage(stage: DealStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}
