"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  ArchiveIcon,
  BookIcon,
  CheckIcon,
  CopyIcon,
  DatabaseIcon,
  KeyIcon,
  LockIcon,
  MonitorIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/shared/icons";
import { useDesktopExperience } from "@/components/providers/desktop-experience-provider";
import { helpContent } from "@/content/ajuda";
import { getDesktopDiagnostics, openDesktopFolder } from "@/lib/desktop/protection";
import { hasTauriRuntime } from "@/lib/desktop/runtime";

const categoryIcons = {
  "primeiros-passos": BookIcon,
  experiencia: SearchIcon,
  seguranca: ShieldIcon,
  backups: ArchiveIcon,
  atualizacoes: RefreshIcon,
};

export default function AjudaView() {
  const { openCommandPalette, notify } = useDesktopExperience();
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState("0.18.0-rc.1");
  const [supportSummary, setSupportSummary] = useState("");
  const [loadingSupport, setLoadingSupport] = useState(false);

  useEffect(() => {
    if (!hasTauriRuntime()) return;
    void getVersion().then(setVersion).catch(() => undefined);
  }, []);

  const categories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return helpContent.categories;
    return helpContent.categories.filter((category) => (
      [category.title, category.description, ...category.items.flat()]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalized)
    ));
  }, [query]);

  async function buildSupportSummary() {
    setLoadingSupport(true);
    try {
      const diagnostics = await getDesktopDiagnostics();
      const summary = [
        `FinnacialUX Desktop ${diagnostics.appVersion}`,
        `Sistema: ${diagnostics.operatingSystem} (${diagnostics.architecture})`,
        `Banco criptografado: ${diagnostics.databaseEncrypted ? "sim" : "não confirmado"}`,
        `SQLCipher: ${diagnostics.databaseCipherVersion || "indisponível"}`,
        `Schema: ${diagnostics.integrity.schemaVersion}`,
        `Integridade: ${diagnostics.integrity.ok ? "ok" : "atenção"}`,
        `Backups registrados: ${diagnostics.backupCount}`,
        `Encerramento anterior inesperado: ${diagnostics.previousUncleanShutdown ? "sim" : "não"}`,
      ].join("\n");
      setSupportSummary(summary);
      let copied = false;
      try {
        await navigator.clipboard.writeText(summary);
        copied = true;
      } catch {
        copied = false;
      }
      notify({
        kind: copied ? "success" : "warning",
        message: copied
          ? "Resumo técnico copiado sem incluir saldos, senhas ou lançamentos."
          : "Resumo técnico preparado. A cópia automática não foi autorizada pelo WebView.",
      });
    } catch (caught) {
      notify({ kind: "error", message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setLoadingSupport(false);
    }
  }

  return (
    <div className="help-page">
      <header className="help-hero">
        <div>
          <span className="section-eyebrow">{helpContent.heading.eyebrow}</span>
          <h1>{helpContent.heading.title}</h1>
          <p>{helpContent.heading.description}</p>
        </div>
        <div className="help-version-card"><MonitorIcon /><span><small>Versão instalada</small><strong>{version}</strong><em>Canal estável</em></span></div>
      </header>

      <section className="help-search-card">
        <SearchIcon />
        <label className="sr-only" htmlFor="help-search">Buscar na ajuda</label>
        <input id="help-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar segurança, backup, atualização ou atalho..." />
        <button type="button" onClick={() => openCommandPalette()}><kbd>Ctrl K</kbd> Comandos</button>
      </section>

      <div className="help-layout">
        <main className="help-content-grid">
          {categories.length ? categories.map((category) => {
            const Icon = categoryIcons[category.id];
            return (
              <section className="help-category-card" key={category.id} id={category.id}>
                <header><span><Icon /></span><div><h2>{category.title}</h2><p>{category.description}</p></div></header>
                <div className="help-category-items">
                  {category.items.map(([title, description]) => <article key={title}><CheckIcon /><div><strong>{title}</strong><p>{description}</p></div></article>)}
                </div>
              </section>
            );
          }) : <div className="help-empty"><SearchIcon /><strong>Nenhum conteúdo encontrado</strong><span>Tente uma palavra diferente ou abra a central de comandos.</span></div>}
        </main>

        <aside className="help-sidebar">
          <section className="help-shortcuts-card">
            <header><KeyIcon /><div><span className="section-eyebrow">Produtividade</span><h2>Atalhos</h2></div></header>
            <div>{helpContent.shortcuts.map(([shortcut, description]) => <p key={shortcut}><kbd>{shortcut}</kbd><span>{description}</span></p>)}</div>
          </section>

          <section className="help-support-card">
            <header><ShieldIcon /><div><span className="section-eyebrow">Suporte seguro</span><h2>Diagnóstico local</h2></div></header>
            <p>Copie um resumo técnico sanitizado ou abra as pastas controladas pelo FinnacialUX.</p>
            <button type="button" className="primary-action-button" disabled={loadingSupport} onClick={() => void buildSupportSummary()}><CopyIcon /> {loadingSupport ? "Preparando..." : "Copiar resumo técnico"}</button>
            <div className="help-support-links">
              <button type="button" onClick={() => void openDesktopFolder("logs")}><BookIcon /> Abrir logs</button>
              <button type="button" onClick={() => void openDesktopFolder("backups")}><ArchiveIcon /> Abrir backups</button>
              <Link href="/configuracoes#diagnostico"><DatabaseIcon /> Diagnóstico completo</Link>
              <Link href="/configuracoes#seguranca"><LockIcon /> Segurança local</Link>
            </div>
            {supportSummary ? <pre>{supportSummary}</pre> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
