import { requestJson } from "@/lib/api/client";
import { apiUrl } from "@/lib/config";
import type { SystemStatus } from "@/lib/types/knowledge";

export async function getSystemStatus(): Promise<SystemStatus> {
  return requestJson<SystemStatus>("/api/v1/system/status");
}

export async function getSettingsPayload(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/api/v1/settings");
}

export async function startEmbeddingDiagnostics(): Promise<{ run_id?: string; detail?: string }> {
  const settings = await getSettingsPayload();
  return requestJson<{ run_id?: string; detail?: string }>("/api/v1/settings/tests/embedding/start", {
    method: "POST",
    body: JSON.stringify({ catalog: settings.catalog })
  });
}

export function embeddingDiagnosticsEventsUrl(runId: string): string {
  return apiUrl(`/api/v1/settings/tests/embedding/${encodeURIComponent(runId)}/events`);
}
