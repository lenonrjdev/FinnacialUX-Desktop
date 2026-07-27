import { desktopFinanceData } from "@/lib/desktop/finance-data";

export type FinanceDataDocument = {
  data: unknown;
  updatedAt: string;
};

export type FinanceDataDocuments = Record<string, FinanceDataDocument>;

export const financeDataApi = {
  list: () => desktopFinanceData.list(),
  get: <T>(module: string) => desktopFinanceData.get<T>(module),
  save: <T>(module: string, data: T) => desktopFinanceData.save(module, data),
  remove: (module: string) => desktopFinanceData.remove(module),
};
