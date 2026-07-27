import { LockIcon, ShieldIcon, WorkspaceIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";

export function AccessOverviewPanel() {
  const items = [
    {
      title: accessContent.accessOverview.privateTitle,
      description: accessContent.accessOverview.privateDescription,
      icon: <LockIcon />,
    },
    {
      title: accessContent.accessOverview.separatedTitle,
      description: accessContent.accessOverview.separatedDescription,
      icon: <WorkspaceIcon />,
    },
    {
      title: accessContent.accessOverview.controlledTitle,
      description: accessContent.accessOverview.controlledDescription,
      icon: <ShieldIcon />,
    },
  ];

  return (
    <section className="access-panel access-overview-panel">
      <header className="access-panel-header dark">
        <div>
          <h2>{accessContent.accessOverview.title}</h2>
          <p>{accessContent.accessOverview.description}</p>
        </div>
      </header>
      <div className="access-overview-list">
        {items.map((item) => (
          <article key={item.title}>
            <span>{item.icon}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
