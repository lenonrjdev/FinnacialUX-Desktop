import { ReportsIcon } from "@/components/shared/icons";
import { overviewContent } from "@/content/visao-geral";
import type { FinancialOverviewData } from "@/lib/use-financial-overview";
import { formatCurrency } from "@/lib/formatters";

export function MonthlyInsight({ data }: { data: FinancialOverviewData }) {
  return (
    <section className="monthly-insight">
      <span className="insight-icon" aria-hidden="true"><ReportsIcon /></span>
      <div>
        <strong>{data.hasFinancialData ? overviewContent.insight.title : "Sua dashboard está pronta."}</strong>
        <p>
          {data.hasFinancialData ? (
            <>
              {overviewContent.insight.descriptionPrefix}{" "}
              {formatCurrency(data.availableAfterCommitments)}{" "}
              {overviewContent.insight.descriptionSuffix}
            </>
          ) : (
            "Cadastre sua primeira conta ou lançamento. Os dados serão salvos no SQLite deste computador e aparecerão aqui automaticamente."
          )}
        </p>
      </div>
      <button type="button">{overviewContent.insight.action}</button>
    </section>
  );
}
