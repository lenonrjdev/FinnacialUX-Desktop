"use client";

import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DashboardLoadingSkeleton } from "@/components/dashboard/dashboard-loading-skeleton";
import { financeDataApi } from "@/lib/api/finance-data";

export type FinanceDataModule =
  | "transactions"
  | "accounts"
  | "account-movements"
  | "credit-cards"
  | "card-invoices"
  | "card-purchases"
  | "installment-plans"
  | "payables"
  | "receivables"
  | "calendar-events"
  | "categories"
  | "monthly-budgets"
  | "goals"
  | "goal-contributions"
  | "debts"
  | "debt-payments"
  | "subscriptions"
  | "subscription-charges"
  | "automation-rules"
  | "import-history"
  | "workspace-settings"
  | "backup-snapshots";

type FinanceDataContextValue = {
  workspaceId: string;
  readOnly: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  documents: Record<string, unknown>;
  updateDocument: <T>(
    module: FinanceDataModule,
    fallback: T,
    action: SetStateAction<T>,
  ) => void;
  reload: () => Promise<void>;
};

const FinanceDataContext = createContext<FinanceDataContextValue | null>(null);

export function FinanceDataProvider({
  workspaceId,
  readOnly,
  children,
}: {
  workspaceId: string;
  readOnly: boolean;
  children: React.ReactNode;
}) {
  const [documents, setDocuments] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [savingCount, setSavingCount] = useState(0);
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
  const [error, setError] = useState("");
  const queues = useRef<Record<string, Promise<unknown>>>({});
  const documentsRef = useRef<Record<string, unknown>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError("");
    documentsRef.current = {};
    setDocuments({});
    queues.current = {};

    try {
      const response = await financeDataApi.list();
      const nextDocuments = Object.fromEntries(
        Object.entries(response).map(([module, document]) => [module, document.data]),
      );
      if (mounted.current) {
        documentsRef.current = nextDocuments;
        setDocuments(nextDocuments);
      }
    } catch (caught) {
      if (mounted.current) {
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar os dados financeiros.");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!loading) {
      setShowLoadingSkeleton(false);
      return;
    }

    const timer = window.setTimeout(() => setShowLoadingSkeleton(true), 160);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const updateDocument = useCallback(<T,>(
    module: FinanceDataModule,
    fallback: T,
    action: SetStateAction<T>,
  ) => {
    if (readOnly) {
      setError("Este espaço está em modo somente leitura.");
      return;
    }

    const currentDocuments = documentsRef.current;
    const previous = Object.prototype.hasOwnProperty.call(currentDocuments, module)
      ? currentDocuments[module] as T
      : fallback;
    const nextValue = typeof action === "function"
      ? (action as (previous: T) => T)(previous)
      : action;
    const nextDocuments = { ...currentDocuments, [module]: nextValue };
    documentsRef.current = nextDocuments;
    setDocuments(nextDocuments);

    setSavingCount((count) => count + 1);
    setError("");
    const previousQueue = queues.current[module] ?? Promise.resolve();
    const nextQueue = previousQueue
      .catch(() => undefined)
      .then(() => financeDataApi.save(module, nextValue))
      .catch((caught) => {
        if (mounted.current) {
          setError(caught instanceof Error ? caught.message : "Não foi possível salvar os dados financeiros.");
        }
      })
      .finally(() => {
        if (mounted.current) setSavingCount((count) => Math.max(0, count - 1));
      });
    queues.current[module] = nextQueue;
  }, [readOnly]);

  const value = useMemo<FinanceDataContextValue>(() => ({
    workspaceId,
    readOnly,
    loading,
    saving: savingCount > 0,
    error,
    documents,
    updateDocument,
    reload,
  }), [documents, error, loading, readOnly, reload, savingCount, updateDocument, workspaceId]);

  const initialLoadFailed = Boolean(error) && Object.keys(documents).length === 0;

  return (
    <FinanceDataContext.Provider value={value}>
      {loading ? (
        showLoadingSkeleton
          ? <DashboardLoadingSkeleton variant="page" label="Carregando seus dados financeiros..." />
          : <div className="financial-data-loading-guard" aria-hidden="true" />
      ) : initialLoadFailed ? (
        <div className="financial-data-load-error" role="alert">
          <strong>Não foi possível carregar seus dados.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => void reload()}>Tentar novamente</button>
        </div>
      ) : children}
      {savingCount > 0 ? <div className="database-sync-status" role="status">Salvando no banco...</div> : null}
      {error && !initialLoadFailed ? <div className="database-sync-error" role="alert">{error}</div> : null}
    </FinanceDataContext.Provider>
  );
}

export function useFinanceDataState<T>(
  module: FinanceDataModule,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(FinanceDataContext);
  if (!context) {
    throw new Error("useFinanceDataState deve ser usado dentro de FinanceDataProvider.");
  }

  const value = Object.prototype.hasOwnProperty.call(context.documents, module)
    ? context.documents[module] as T
    : fallback;

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    context.updateDocument(module, fallback, action);
  }, [context, fallback, module]);

  return [value, setValue];
}

export function useFinanceDataStatus() {
  const context = useContext(FinanceDataContext);
  if (!context) {
    throw new Error("useFinanceDataStatus deve ser usado dentro de FinanceDataProvider.");
  }
  return {
    loading: context.loading,
    saving: context.saving,
    error: context.error,
    readOnly: context.readOnly,
    workspaceId: context.workspaceId,
    reload: context.reload,
  };
}
