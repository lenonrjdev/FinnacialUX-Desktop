import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  EditIcon,
  MagicWandIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/shared/icons";
import { dataToolsContent } from "@/content/dados-e-automacoes";
import type { AutomationRule, RuleTestResult } from "@/types/dados-e-automacoes";

function actionLabels(rule: AutomationRule): string[] {
  const labels: string[] = [];
  if (rule.actions.category) labels.push(`${dataToolsContent.rules.actions.category}: ${rule.actions.category}`);
  if (rule.actions.account) labels.push(`${dataToolsContent.rules.actions.account}: ${rule.actions.account}`);
  if (rule.actions.type) labels.push(`${dataToolsContent.rules.actions.type}: ${dataToolsContent.preview[rule.actions.type]}`);
  return labels;
}

export function RulesPanel({
  rules,
  testResults,
  onCreate,
  onEdit,
  onToggle,
  onDelete,
  onMove,
  onTest,
}: {
  rules: AutomationRule[];
  testResults: RuleTestResult[];
  onCreate: () => void;
  onEdit: (rule: AutomationRule) => void;
  onToggle: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => void;
  onMove: (rule: AutomationRule, direction: -1 | 1) => void;
  onTest: () => void;
}) {
  const ordered = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <section className="rules-layout">
      <article className="data-tool-panel rules-list-panel">
        <header className="data-tool-panel-header rules-panel-header">
          <div>
            <span className="section-eyebrow">{dataToolsContent.views.rules}</span>
            <h2>{dataToolsContent.rules.title}</h2>
            <p>{dataToolsContent.rules.description}</p>
          </div>
          <div className="rules-header-actions">
            <button className="secondary-action-button" type="button" onClick={onTest}><CheckIcon />{dataToolsContent.rules.test}</button>
            <button className="primary-action-button" type="button" onClick={onCreate}><PlusIcon />{dataToolsContent.rules.newRule}</button>
          </div>
        </header>

        <div className="automation-rules-list">
          {ordered.length ? ordered.map((rule, index) => {
            const result = testResults.find((item) => item.ruleId === rule.id);
            return (
              <article className={`automation-rule-card ${rule.active ? "active" : "paused"}`} key={rule.id}>
                <div className="rule-priority-control">
                  <button type="button" disabled={index === 0} onClick={() => onMove(rule, -1)} aria-label={dataToolsContent.rules.moveUp}><ArrowUpIcon /></button>
                  <strong>{rule.priority}</strong>
                  <button type="button" disabled={index === ordered.length - 1} onClick={() => onMove(rule, 1)} aria-label={dataToolsContent.rules.moveDown}><ArrowDownIcon /></button>
                </div>
                <span className="automation-rule-icon"><MagicWandIcon /></span>
                <div className="automation-rule-content">
                  <div className="automation-rule-title-row">
                    <div>
                      <strong>{rule.name}</strong>
                      <span className={rule.active ? "active" : "paused"}>{rule.active ? dataToolsContent.rules.active : dataToolsContent.rules.paused}</span>
                    </div>
                    <small>{dataToolsContent.rules.priority} {rule.priority}</small>
                  </div>
                  <div className="automation-rule-definition">
                    <div>
                      <span>{dataToolsContent.rules.condition}</span>
                      <p><strong>{dataToolsContent.rules.fields[rule.field]}</strong> {dataToolsContent.rules.operators[rule.operator]} <b>“{rule.value}”</b></p>
                    </div>
                    <div>
                      <span>{dataToolsContent.rules.action}</span>
                      <p>{actionLabels(rule).join(" · ")}</p>
                    </div>
                  </div>
                  {result ? <p className="rule-match-count">{result.matches} {dataToolsContent.rules.matches}</p> : null}
                </div>
                <div className="automation-rule-actions">
                  <button type="button" onClick={() => onEdit(rule)}><EditIcon />{dataToolsContent.rules.edit}</button>
                  <button type="button" onClick={() => onToggle(rule)}>{rule.active ? dataToolsContent.rules.pause : dataToolsContent.rules.resume}</button>
                  <button className="danger" type="button" onClick={() => onDelete(rule)}><TrashIcon />{dataToolsContent.rules.remove}</button>
                </div>
              </article>
            );
          }) : <p className="data-tools-empty-copy">{dataToolsContent.rules.noRules}</p>}
        </div>
      </article>

      <aside className="data-tool-panel rule-test-panel">
        <header className="data-tool-panel-header compact">
          <div>
            <span className="section-eyebrow">{dataToolsContent.rules.test}</span>
            <h2>{dataToolsContent.rules.testTitle}</h2>
            <p>{dataToolsContent.rules.testDescription}</p>
          </div>
        </header>
        <div className="rule-test-results">
          {testResults.some((item) => item.matches > 0) ? testResults.filter((item) => item.matches > 0).map((result) => {
            const rule = rules.find((item) => item.id === result.ruleId);
            if (!rule) return null;
            return (
              <div key={result.ruleId}>
                <span><MagicWandIcon /></span>
                <div>
                  <strong>{rule.name}</strong>
                  <small>{result.matches} {dataToolsContent.rules.matches}</small>
                  <p>{result.examples.join(" · ")}</p>
                </div>
              </div>
            );
          }) : <p className="data-tools-empty-copy">{dataToolsContent.rules.noMatches}</p>}
        </div>
      </aside>
    </section>
  );
}
