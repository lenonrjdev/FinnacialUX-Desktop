"use client";

import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  ArchiveIcon,
  CheckIcon,
  DownloadIcon,
  FileCheckIcon,
  FileIcon,
  HistoryIcon,
  LockIcon,
  RefreshIcon,
  ShieldIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { buildAllExportTables, tableToCsv } from "@/lib/data-tools";
import {
  chooseAndReadUserFile,
  chooseAndWriteUserFile,
  encodeUtf8,
} from "@/lib/desktop/file-transfer";
import {
  applyPortabilityDocuments,
  getLocalWorkspaceId,
  getWorkspaceDocuments,
  listPortabilityOperations,
  recordPortabilityOperation,
  undoPortabilityOperation,
} from "@/lib/desktop/portability";
import {
  buildPortablePayload,
  decryptPortablePackage,
  encryptPortablePackage,
  mergePortableDocuments,
  sha256Hex,
} from "@/lib/portable-package";
import { buildSpreadsheetFile, buildTemplateWorkbook } from "@/lib/spreadsheet";
import type { FinancialExportData } from "@/lib/data-tools";
import type {
  PortableImportMode,
  PortableImportPreview,
  PortabilityOperation,
} from "@/types/dados-e-automacoes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function directionLabel(direction: PortabilityOperation["direction"]) {
  if (direction === "import") return "Importação";
  if (direction === "export") return "Exportação";
  if (direction === "transfer") return "Transferência";
  return "Desfazer";
}

export function PortabilityPanel({
  financialData,
  startDate,
  endDate,
  onReload,
  onFeedback,
}: {
  financialData: FinancialExportData;
  startDate: string;
  endDate: string;
  onReload: () => Promise<void>;
  onFeedback: (message: string) => void;
}) {
  const { confirmSensitiveAction } = useDesktopSecurity();
  const [operations, setOperations] = useState<PortabilityOperation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordConfirmation, setExportPasswordConfirmation] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importMode, setImportMode] = useState<PortableImportMode>("merge");
  const [portableFile, setPortableFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [portablePreview, setPortablePreview] = useState<PortableImportPreview | null>(null);

  const reversibleCount = useMemo(
    () => operations.filter((operation) => operation.reversible && operation.status !== "undone").length,
    [operations],
  );

  async function refreshHistory() {
    setLoadingHistory(true);
    try {
      setOperations(await listPortabilityOperations());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o histórico de portabilidade.");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    void refreshHistory();
  }, []);

  async function exportPortable() {
    setError("");
    if (exportPassword !== exportPasswordConfirmation) {
      setError("A confirmação da senha do pacote portátil não confere.");
      return;
    }
    if (!(await confirmSensitiveAction("export"))) return;
    setBusy("export-portable");
    try {
      const documents = await getWorkspaceDocuments();
      let appVersion = "0.8.0";
      try { appVersion = await getVersion(); } catch { /* fallback para navegador */ }
      const payload = await buildPortablePayload({
        appVersion,
        workspaceId: getLocalWorkspaceId(),
        documents,
      });
      const packaged = await encryptPortablePackage(payload, exportPassword);
      const fileName = `FinnacialUX-Meus-Dados-${new Date().toISOString().slice(0, 10)}.fuxportable`;
      const destination = await chooseAndWriteUserFile({
        bytes: packaged.bytes,
        defaultFileName: fileName,
        filters: [{ name: "Pacote portátil FinnacialUX", extensions: ["fuxportable"] }],
        title: "Salvar pacote portátil protegido",
      });
      if (!destination) return;
      await recordPortabilityOperation({
        direction: "transfer",
        format: "fuxportable",
        dataset: "workspace",
        fileName,
        checksumSha256: packaged.checksumSha256,
        recordsTotal: payload.totals.records,
        recordsApplied: payload.totals.records,
        affectedModules: Object.keys(documents),
      });
      setExportPassword("");
      setExportPasswordConfirmation("");
      await refreshHistory();
      onFeedback("Pacote portátil criptografado gerado com sucesso.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar o pacote portátil.");
    } finally {
      setBusy("");
    }
  }

  async function choosePortablePackage() {
    setError("");
    setPortablePreview(null);
    const selected = await chooseAndReadUserFile([
      { name: "Pacote portátil FinnacialUX", extensions: ["fuxportable"] },
    ], "Selecionar pacote portátil");
    if (selected) setPortableFile({ name: selected.name, bytes: selected.bytes });
  }

  async function inspectPortablePackage() {
    if (!portableFile) return;
    setBusy("inspect-portable");
    setError("");
    try {
      setPortablePreview(await decryptPortablePackage(portableFile.bytes, importPassword, portableFile.name));
    } catch (caught) {
      setPortablePreview(null);
      setError(caught instanceof Error ? caught.message : "Não foi possível abrir o pacote portátil.");
    } finally {
      setBusy("");
    }
  }

  async function importPortable() {
    if (!portablePreview) return;
    if (!(await confirmSensitiveAction("restore"))) return;
    setBusy("import-portable");
    setError("");
    try {
      const current = await getWorkspaceDocuments();
      const documents = importMode === "merge"
        ? mergePortableDocuments(current, portablePreview.documents)
        : portablePreview.documents;
      await applyPortabilityDocuments({
        documents,
        mode: "replace",
        operation: {
          direction: "import",
          format: "fuxportable",
          dataset: "workspace",
          fileName: portablePreview.fileName,
          checksumSha256: portablePreview.checksumSha256,
          recordsTotal: portablePreview.records,
          recordsApplied: portablePreview.records,
          affectedModules: portablePreview.modules,
        },
      });
      await onReload();
      await refreshHistory();
      setPortableFile(null);
      setPortablePreview(null);
      setImportPassword("");
      onFeedback("Pacote portátil importado e validado. A operação pode ser desfeita pelo histórico.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível importar o pacote portátil.");
    } finally {
      setBusy("");
    }
  }

  async function exportFullSpreadsheet() {
    if (!(await confirmSensitiveAction("export"))) return;
    setBusy("export-xlsx");
    setError("");
    try {
      const tables = buildAllExportTables(startDate, endDate, financialData);
      const bytes = await buildSpreadsheetFile(tables.map((item) => ({ name: item.name, table: item.table })));
      const fileName = `FinnacialUX-exportacao-completa-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const destination = await chooseAndWriteUserFile({
        bytes,
        defaultFileName: fileName,
        filters: [{ name: "Planilha Excel", extensions: ["xlsx"] }],
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      if (!destination) return;
      await recordPortabilityOperation({
        direction: "export",
        format: "xlsx",
        dataset: "workspace",
        fileName,
        checksumSha256: await sha256Hex(bytes),
        recordsTotal: tables.reduce((total, item) => total + item.table.rows.length, 0),
        recordsApplied: tables.reduce((total, item) => total + item.table.rows.length, 0),
        affectedModules: tables.map((item) => item.dataset),
      });
      await refreshHistory();
      onFeedback("Planilha completa exportada com sucesso.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar a planilha completa.");
    } finally {
      setBusy("");
    }
  }

  async function downloadTemplate(type: "csv" | "xlsx") {
    setBusy(`template-${type}`);
    setError("");
    try {
      if (type === "csv") {
        const table = {
          fileBase: "modelo-lancamentos",
          headers: ["Data", "Descrição", "Valor", "Tipo", "Categoria", "Conta"],
          rows: [["29/07/2026", "Exemplo de lançamento", -125.9, "Despesa", "Alimentação", "Conta principal"]],
        };
        await chooseAndWriteUserFile({
          bytes: encodeUtf8(tableToCsv(table, ";", true)),
          defaultFileName: "modelo-lancamentos-finnacialux.csv",
          filters: [{ name: "Arquivo CSV", extensions: ["csv"] }],
          mimeType: "text/csv;charset=utf-8",
        });
      } else {
        await chooseAndWriteUserFile({
          bytes: await buildTemplateWorkbook(),
          defaultFileName: "modelo-completo-finnacialux.xlsx",
          filters: [{ name: "Planilha Excel", extensions: ["xlsx"] }],
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      }
      onFeedback("Modelo gerado com sucesso.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar o modelo.");
    } finally {
      setBusy("");
    }
  }

  async function undoOperation(operation: PortabilityOperation) {
    if (!window.confirm(`Desfazer a operação “${operation.fileName}” e restaurar o estado anterior dos dados?`)) return;
    if (!(await confirmSensitiveAction("restore"))) return;
    setBusy(`undo-${operation.id}`);
    setError("");
    try {
      await undoPortabilityOperation(operation.id);
      await onReload();
      await refreshHistory();
      onFeedback("Importação desfeita e dados anteriores restaurados.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível desfazer a operação.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="portability-layout">
      <article className="data-tool-panel portability-transfer-panel">
        <header className="data-tool-panel-header">
          <div>
            <span className="section-eyebrow">Transferência protegida</span>
            <h2>Mover seus dados para outro computador</h2>
            <p>Crie um pacote criptografado por senha. O computador de destino gera sua própria chave SQLCipher ao importar.</p>
          </div>
          <span className="data-tool-panel-icon"><ArchiveIcon /></span>
        </header>

        <div className="portability-columns">
          <section className="portability-action-card">
            <span className="portability-action-icon"><LockIcon /></span>
            <h3>Exportar pacote portátil</h3>
            <p>Inclui todos os módulos, manifesto, checksums individuais e criptografia AES-256-GCM.</p>
            <label className="form-field">
              <span>Senha do pacote</span>
              <input type="password" value={exportPassword} minLength={10} autoComplete="new-password" onChange={(event) => setExportPassword(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Confirmar senha</span>
              <input type="password" value={exportPasswordConfirmation} minLength={10} autoComplete="new-password" onChange={(event) => setExportPasswordConfirmation(event.target.value)} />
            </label>
            <button className="primary-action-button" type="button" disabled={Boolean(busy)} onClick={() => void exportPortable()}>
              <DownloadIcon />{busy === "export-portable" ? "Protegendo pacote..." : "Gerar .fuxportable"}
            </button>
          </section>

          <section className="portability-action-card">
            <span className="portability-action-icon"><UploadIcon /></span>
            <h3>Importar pacote portátil</h3>
            <p>Valide a senha, confira a origem e escolha entre mesclar ou substituir o espaço atual.</p>
            <button className="secondary-action-button" type="button" disabled={Boolean(busy)} onClick={() => void choosePortablePackage()}>
              <FileIcon />{portableFile?.name ?? "Selecionar .fuxportable"}
            </button>
            <label className="form-field">
              <span>Senha do pacote</span>
              <input type="password" value={importPassword} autoComplete="current-password" onChange={(event) => setImportPassword(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Modo de importação</span>
              <select value={importMode} onChange={(event) => setImportMode(event.target.value as PortableImportMode)}>
                <option value="merge">Mesclar e atualizar registros com o mesmo ID</option>
                <option value="replace">Substituir todo o espaço atual</option>
              </select>
            </label>
            {!portablePreview ? (
              <button className="secondary-action-button" type="button" disabled={!portableFile || !importPassword || Boolean(busy)} onClick={() => void inspectPortablePackage()}>
                <ShieldIcon />{busy === "inspect-portable" ? "Validando..." : "Validar pacote"}
              </button>
            ) : (
              <div className="portable-preview-card">
                <strong><FileCheckIcon /> Pacote validado</strong>
                <span>Versão de origem: {portablePreview.appVersion}</span>
                <span>{portablePreview.modules.length} módulos · {portablePreview.records} registros</span>
                <span>Exportado em {formatDate(portablePreview.exportedAt)}</span>
                <button className="primary-action-button" type="button" disabled={Boolean(busy)} onClick={() => void importPortable()}>
                  <UploadIcon />{busy === "import-portable" ? "Importando..." : "Importar com snapshot de segurança"}
                </button>
              </div>
            )}
          </section>
        </div>
      </article>

      <aside className="data-tool-panel portability-templates-panel">
        <header className="data-tool-panel-header compact">
          <div>
            <span className="section-eyebrow">Modelos e exportação</span>
            <h2>Arquivos prontos</h2>
            <p>Use modelos oficiais ou exporte todos os módulos em uma pasta de trabalho Excel.</p>
          </div>
        </header>
        <div className="portability-template-actions">
          <button type="button" onClick={() => void downloadTemplate("csv")} disabled={Boolean(busy)}><FileIcon /><span><strong>Modelo CSV</strong><small>Lançamentos com padrão pt-BR</small></span></button>
          <button type="button" onClick={() => void downloadTemplate("xlsx")} disabled={Boolean(busy)}><FileIcon /><span><strong>Modelo Excel completo</strong><small>Abas para os módulos principais</small></span></button>
          <button type="button" onClick={() => void exportFullSpreadsheet()} disabled={Boolean(busy)}><DownloadIcon /><span><strong>Exportação Excel completa</strong><small>Uma aba por conjunto de dados</small></span></button>
        </div>
        <div className="portability-security-note"><ShieldIcon /><p>Pacotes portáteis nunca incluem a chave SQLCipher, PIN, senha de login ou segredo do Stronghold.</p></div>
      </aside>

      <article className="data-tool-panel portability-history-panel">
        <header className="data-tool-panel-header">
          <div>
            <span className="section-eyebrow">Auditoria local</span>
            <h2>Histórico de portabilidade</h2>
            <p>Operações ficam registradas dentro do banco SQLCipher. Importações reversíveis guardam um snapshot anterior.</p>
          </div>
          <div className="portability-history-header-actions">
            <span>{reversibleCount} reversíveis</span>
            <button type="button" onClick={() => void refreshHistory()} disabled={loadingHistory}><RefreshIcon />Atualizar</button>
          </div>
        </header>
        {loadingHistory ? <p className="data-tools-empty-copy">Carregando histórico...</p> : operations.length ? (
          <div className="import-history-table-scroll">
            <table className="import-history-table portability-history-table">
              <thead><tr><th>Operação</th><th>Arquivo</th><th>Data</th><th>Registros</th><th>Situação</th><th>Ação</th></tr></thead>
              <tbody>{operations.map((operation) => (
                <tr key={operation.id}>
                  <td><span className="history-file-icon"><HistoryIcon /></span><div><strong>{directionLabel(operation.direction)}</strong><small>{operation.format.toUpperCase()}</small></div></td>
                  <td><strong>{operation.fileName}</strong><small className="history-checksum">{operation.checksumSha256?.slice(0, 12) ?? "sem checksum"}</small></td>
                  <td>{formatDate(operation.createdAt)}</td>
                  <td>{operation.recordsApplied}/{operation.recordsTotal}</td>
                  <td><span className={`history-status ${operation.status === "completed" ? "completed" : "partial"}`}>{operation.status === "completed" ? <CheckIcon /> : <WarningIcon />}{operation.status}</span></td>
                  <td>{operation.reversible && operation.status !== "undone" ? <button className="data-tools-link-button" type="button" disabled={Boolean(busy)} onClick={() => void undoOperation(operation)}>Desfazer</button> : <span>—</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="data-tools-empty-copy">Nenhuma operação de portabilidade registrada.</p>}
      </article>

      {error ? <div className="portability-error" role="alert"><WarningIcon />{error}</div> : null}
    </section>
  );
}
