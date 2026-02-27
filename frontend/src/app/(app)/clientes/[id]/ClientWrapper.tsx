"use client";
import { AgentPanel } from "./AgentPanel";
import type { Prediction } from "@/types";

interface Props {
  prediction: Prediction;
  orgId: string;
}

export function ClientWrapper({ prediction, orgId }: Props) {
  return <AgentPanel prediction={prediction} orgId={orgId} />;
}
