export type ReleaseChannel = "development" | "release-candidate" | "stable";
export type ReleaseCheckStatus = "passed" | "attention" | "blocked";

export type ReleaseConfig = {
  formatVersion: number;
  product: string;
  version: string;
  channel: "release-candidate" | "stable";
  schemaVersion: number;
  schemaFrozen: boolean;
  promotedFrom?: string;
  promotedFromTag?: string;
  target: string;
  tag: string;
  prerelease: boolean;
  makeLatest: boolean;
  requiredArtifacts: string[];
  manualMatrix: string[];
};

export type ReleaseSnapshot = {
  version: string;
  schemaVersion: number | null;
  updaterConfigured: boolean;
  developmentBuild: boolean;
  backupBeforeInstall: boolean;
  windowsRuntime: boolean;
};

export type ReleaseReadinessCheck = {
  id: string;
  title: string;
  detail: string;
  status: ReleaseCheckStatus;
  required: boolean;
};

export type ReleaseReadinessReport = {
  channel: ReleaseChannel;
  expectedVersion: string;
  promotedFrom: string | null;
  tag: string;
  assetName: string;
  ready: boolean;
  passed: number;
  attention: number;
  blocked: number;
  checks: ReleaseReadinessCheck[];
};

export type ParsedDesktopVersion = {
  valid: boolean;
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

export type ReleaseCandidateConfig = ReleaseConfig;
export type ReleaseCandidateSnapshot = ReleaseSnapshot;
