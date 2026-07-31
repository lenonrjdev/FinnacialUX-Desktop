import { invoke } from "@tauri-apps/api/core";
import { ApiError } from "@/lib/api/client";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type {
  OnboardingSkipRequest,
  OnboardingState,
  OnboardingStepCode,
  OnboardingSyncRequest,
  SaveOnboardingPreferencesRequest,
} from "@/types/onboarding";

function ensureDesktop() {
  if (!hasTauriRuntime()) {
    throw new ApiError("O guia persistente está disponível no aplicativo Desktop.", 400);
  }
}

function assertWritable() {
  if (isSafeModeEnabled()) {
    throw new ApiError("O modo somente leitura está ativo. O progresso do guia não será alterado.", 423);
  }
}

export function getOnboardingState(workspaceId: string): Promise<OnboardingState> {
  ensureDesktop();
  return invoke<OnboardingState>("onboarding_get_state", { workspaceId });
}

export function syncOnboardingProgress(request: OnboardingSyncRequest): Promise<OnboardingState> {
  ensureDesktop();
  return invoke<OnboardingState>("onboarding_sync_progress", { request });
}

export function completeOnboardingStep(
  workspaceId: string,
  stepCode: OnboardingStepCode,
): Promise<OnboardingState> {
  ensureDesktop();
  assertWritable();
  return invoke<OnboardingState>("onboarding_complete_step", {
    request: { workspaceId, stepCode },
  });
}

export function skipOnboardingGuide(request: OnboardingSkipRequest): Promise<OnboardingState> {
  ensureDesktop();
  assertWritable();
  return invoke<OnboardingState>("onboarding_skip_guide", { request });
}

export function resetOnboardingGuide(workspaceId: string): Promise<OnboardingState> {
  ensureDesktop();
  assertWritable();
  return invoke<OnboardingState>("onboarding_reset_guide", { workspaceId });
}

export function saveOnboardingPreferences(
  request: SaveOnboardingPreferencesRequest,
): Promise<OnboardingState> {
  ensureDesktop();
  assertWritable();
  return invoke<OnboardingState>("onboarding_save_preferences", { request });
}
