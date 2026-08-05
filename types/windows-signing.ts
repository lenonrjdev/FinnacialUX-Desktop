export type WindowsSigningProvider = "certificate-store" | "pfx" | "custom-command";

export type WindowsSigningSnapshot = {
  provider: WindowsSigningProvider | null;
  configured: boolean;
  signToolAvailable: boolean;
  certificateFound: boolean;
  hasPrivateKey: boolean;
  codeSigningEku: boolean;
  trustedChain: boolean;
  timestampConfigured: boolean;
  expectedPublisherConfigured: boolean;
  expiresAt: string | null;
  now?: string;
};

export type WindowsSigningCheck = {
  id: string;
  title: string;
  detail: string;
  status: "passed" | "attention" | "blocked";
  required: boolean;
};

export type WindowsSigningReadiness = {
  ready: boolean;
  score: number;
  passed: number;
  attention: number;
  blocked: number;
  expiresInDays: number | null;
  checks: WindowsSigningCheck[];
};

export type WindowsSigningConfiguration = {
  formatVersion: 1;
  provider: WindowsSigningProvider;
  publisherDisplayName: string;
  expectedPublisher: string;
  timestampUrl: string;
  digestAlgorithm: "SHA256";
  timestampDigestAlgorithm: "SHA256";
  certificateStore?: {
    location: "CurrentUser" | "LocalMachine";
    name: "My";
    thumbprint: string;
  };
  pfx?: { path: string };
  customCommand?: { cmd: string; args: string[] };
};
