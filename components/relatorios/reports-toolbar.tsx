import { CalendarIcon, ReportsIcon } from "@/components/shared/icons";
import { reportsContent } from "@/content/relatorios";
import type { ProjectionScenario, ReportPeriod, ReportView } from "@/types/relatorios";

export function ReportsToolbar({
  view,
  period,
  scenario,
  onViewChange,
  onPeriodChange,
  onScenarioChange,
}: {
  view: ReportView;
  period: ReportPeriod;
  scenario: ProjectionScenario;
  onViewChange: (view: ReportView) => void;
  onPeriodChange: (period: ReportPeriod) => void;
  onScenarioChange: (scenario: ProjectionScenario) => void;
}) {
  return (
    <section className="reports-toolbar">
      <div className="reports-view-tabs" role="tablist" aria-label={reportsContent.accessibility.views}>
        <button
          type="button"
          className={view === "reports" ? "active" : ""}
          onClick={() => onViewChange("reports")}
        >
          <ReportsIcon />
          {reportsContent.views.reports}
        </button>
        <button
          type="button"
          className={view === "projection" ? "active" : ""}
          onClick={() => onViewChange("projection")}
        >
          <CalendarIcon />
          {reportsContent.views.projection}
        </button>
      </div>

      {view === "reports" ? (
        <label className="reports-control-field">
          <span>{reportsContent.toolbar.period}</span>
          <select value={period} onChange={(event) => onPeriodChange(event.target.value as ReportPeriod)}>
            <option value="current-month">{reportsContent.toolbar.currentMonth}</option>
            <option value="last-3-months">{reportsContent.toolbar.lastThreeMonths}</option>
            <option value="last-6-months">{reportsContent.toolbar.lastSixMonths}</option>
            <option value="year">{reportsContent.toolbar.year}</option>
          </select>
        </label>
      ) : (
        <label className="reports-control-field scenario-control-field">
          <span>{reportsContent.toolbar.scenario}</span>
          <select value={scenario} onChange={(event) => onScenarioChange(event.target.value as ProjectionScenario)}>
            <option value="conservative">{reportsContent.scenarios.conservative.label}</option>
            <option value="realistic">{reportsContent.scenarios.realistic.label}</option>
            <option value="optimistic">{reportsContent.scenarios.optimistic.label}</option>
          </select>
          <small>{reportsContent.scenarios[scenario].helper}</small>
        </label>
      )}
    </section>
  );
}
