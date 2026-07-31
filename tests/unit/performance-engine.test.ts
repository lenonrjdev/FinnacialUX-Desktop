import { describe, expect, it } from "vitest";
import {
  buildBatchPlan,
  calculateReusablePercent,
  databaseHealthLabel,
  normalizeImportBatchSize,
  normalizePageSize,
  normalizeTransactionFilters,
  operationPercent,
  summarizeBenchmark,
} from "@/lib/performance-engine";
import type { DatabasePerformanceHealth } from "@/types/performance";

const health: DatabasePerformanceHealth = {
  schemaVersion: 11,
  pageCount: 1_000,
  freePages: 10,
  pageSizeBytes: 4_096,
  databaseSizeBytes: 4_096_000,
  reusableBytes: 40_960,
  reusablePercent: 1,
  journalMode: "wal",
  transactionIndexRows: 10_000,
  indexedWorkspaces: 1,
  metricsCount: 4,
  runningOperations: 0,
  lastAnalyzeAt: null,
};

describe("motor local de desempenho", () => {
  it("limita páginas e lotes aos contratos seguros", () => {
    expect(normalizePageSize(1)).toBe(25);
    expect(normalizePageSize(900)).toBe(250);
    expect(normalizeImportBatchSize(1)).toBe(100);
    expect(normalizeImportBatchSize(9_000)).toBe(2_000);
  });

  it("divide grandes importações sem perder o último lote", () => {
    expect(buildBatchPlan(1_250, 500)).toEqual([
      { start: 0, end: 500 },
      { start: 500, end: 1_000 },
      { start: 1_000, end: 1_250 },
    ]);
  });

  it("normaliza filtros antes de chamar a paginação nativa", () => {
    expect(normalizeTransactionFilters({ page: 0, pageSize: 999, search: "  Mercado  ", type: "all" })).toMatchObject({
      page: 1,
      pageSize: 250,
      search: "Mercado",
      type: undefined,
    });
  });

  it("calcula progresso e espaço reutilizável sem divisões inválidas", () => {
    expect(operationPercent(250, 1_000)).toBe(25);
    expect(operationPercent(10, 0)).toBe(0);
    expect(calculateReusablePercent(1_000, 125)).toBe(12.5);
  });

  it("resume o benchmark contra a meta local", () => {
    expect(summarizeBenchmark(20_000, 50, 90, 110, 250, "checksum")).toEqual({
      totalItems: 20_000,
      pageSize: 50,
      firstPageMs: 90,
      lastPageMs: 110,
      averagePageMs: 100,
      targetMs: 250,
      withinTarget: true,
      sourceChecksum: "checksum",
    });
  });

  it("recomenda manutenção apenas quando o espaço livre é relevante", () => {
    expect(databaseHealthLabel(health)).toBe("healthy");
    expect(databaseHealthLabel({ ...health, reusablePercent: 25 })).toBe("maintenance");
    expect(databaseHealthLabel({ ...health, runningOperations: 1 })).toBe("attention");
  });
});
