type DashboardLoadingSkeletonProps = {
  variant?: "shell" | "page";
  label?: string;
};

function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <span className="dashboard-skeleton-line" style={{ width }} aria-hidden="true" />;
}

function PageSkeletonContent() {
  return (
    <div className="dashboard-page-skeleton" aria-hidden="true">
      <div className="dashboard-page-skeleton-heading">
        <div>
          <SkeletonLine width="92px" />
          <SkeletonLine width="220px" />
          <SkeletonLine width="360px" />
        </div>
        <SkeletonLine width="180px" />
      </div>

      <div className="dashboard-page-skeleton-cards">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="dashboard-skeleton-card" key={index}>
            <span className="dashboard-skeleton-icon" />
            <SkeletonLine width="42%" />
            <SkeletonLine width="58%" />
            <SkeletonLine width="76%" />
          </div>
        ))}
      </div>

      <div className="dashboard-page-skeleton-grid">
        <div className="dashboard-skeleton-panel dashboard-skeleton-panel--wide">
          <div className="dashboard-skeleton-panel-heading">
            <div>
              <SkeletonLine width="92px" />
              <SkeletonLine width="170px" />
            </div>
            <SkeletonLine width="64px" />
          </div>
          <div className="dashboard-skeleton-chart">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} style={{ height: `${32 + index * 8}%` }} />
            ))}
          </div>
        </div>

        <div className="dashboard-skeleton-panel dashboard-skeleton-panel--side">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="dashboard-skeleton-list-row" key={index}>
              <SkeletonLine width="42%" />
              <SkeletonLine width="64%" />
              <SkeletonLine width="84%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardLoadingSkeleton({
  variant = "page",
  label = "Carregando a dashboard...",
}: DashboardLoadingSkeletonProps) {
  if (variant === "page") {
    return (
      <div className="dashboard-loading-region" role="status" aria-label={label}>
        <PageSkeletonContent />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div className="app-shell dashboard-shell-skeleton" role="status" aria-label={label}>
      <aside className="dashboard-skeleton-sidebar" aria-hidden="true">
        <div className="dashboard-skeleton-brand">
          <span className="dashboard-skeleton-logo" />
          <SkeletonLine width="72px" />
        </div>
        <div className="dashboard-skeleton-navigation">
          {Array.from({ length: 11 }, (_, index) => (
            <div className="dashboard-skeleton-nav-item" key={index}>
              <span className="dashboard-skeleton-nav-icon" />
              <SkeletonLine width={`${48 + (index % 4) * 10}%`} />
            </div>
          ))}
        </div>
        <div className="dashboard-skeleton-account">
          <span className="dashboard-skeleton-avatar" />
          <div>
            <SkeletonLine width="108px" />
            <SkeletonLine width="72px" />
          </div>
        </div>
      </aside>

      <div className="dashboard-skeleton-workspace">
        <div className="dashboard-skeleton-topbar" aria-hidden="true">
          <SkeletonLine width="210px" />
          <div>
            <SkeletonLine width="128px" />
            <span className="dashboard-skeleton-button" />
            <span className="dashboard-skeleton-avatar dashboard-skeleton-avatar--small" />
          </div>
        </div>
        <main className="dashboard-skeleton-main">
          <PageSkeletonContent />
        </main>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
