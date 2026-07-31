"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { scoreCommandSearch } from "@/lib/onboarding-engine";
import {
  ArchiveIcon,
  BookIcon,
  CloseIcon,
  DatabaseIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TransactionsIcon,
} from "@/components/shared/icons";

export type DesktopCommand = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  shortcut?: string;
  category?: "Navegação" | "Ações" | "Configurações" | "Ajuda";
  icon: "search" | "transaction" | "backup" | "lock" | "settings" | "data" | "help" | "database";
  run: () => void | Promise<void>;
};

const iconMap = {
  search: SearchIcon,
  transaction: PlusIcon,
  backup: ArchiveIcon,
  lock: LockIcon,
  settings: SettingsIcon,
  data: TransactionsIcon,
  help: BookIcon,
  database: DatabaseIcon,
};

export function DesktopCommandPalette({
  open,
  initialQuery = "",
  mode = "commands",
  commands,
  onClose,
}: {
  open: boolean;
  initialQuery?: string;
  mode?: "commands" | "search";
  commands: DesktopCommand[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setActiveIndex(0);
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [initialQuery, open]);

  const filtered = useMemo(() => {
    let recent: string[] = [];
    if (typeof window !== "undefined") {
      try {
        recent = JSON.parse(window.localStorage.getItem("finnacialux-command-history-v1") || "[]");
      } catch {
        recent = [];
      }
    }
    return commands
      .map((command) => ({
        command,
        score: scoreCommandSearch(query, command, recent.indexOf(command.id)),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => right.score - left.score || left.command.label.localeCompare(right.command.label, "pt-BR"))
      .map((entry) => entry.command);
  }, [commands, query]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [activeIndex, filtered.length]);

  if (!open) return null;

  async function execute(command: DesktopCommand | undefined) {
    if (!command) return;
    try {
      const current = JSON.parse(window.localStorage.getItem("finnacialux-command-history-v1") || "[]") as string[];
      const next = [command.id, ...current.filter((id) => id !== command.id)].slice(0, 12);
      window.localStorage.setItem("finnacialux-command-history-v1", JSON.stringify(next));
    } catch {
      // O histórico é apenas uma preferência local opcional.
    }
    onClose();
    await command.run();
  }

  return (
    <div className="desktop-command-overlay" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section
        ref={paletteRef}
        className="desktop-command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-command-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "Tab") {
            const focusable = Array.from(
              paletteRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
              ) ?? [],
            );
            const first = focusable[0];
            const last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => filtered.length ? (current + 1) % filtered.length : 0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => filtered.length ? (current - 1 + filtered.length) % filtered.length : 0);
          } else if (event.key === "Enter") {
            event.preventDefault();
            void execute(filtered[activeIndex]);
          }
        }}
      >
        <header className="desktop-command-search">
          <SearchIcon aria-hidden="true" />
          <label className="sr-only" htmlFor="desktop-command-query" id="desktop-command-title">{mode === "search" ? "Busca rápida" : "Central de comandos"}</label>
          <input
            id="desktop-command-query"
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            placeholder={mode === "search" ? "Buscar páginas, módulos, ações e ajuda..." : "Buscar páginas, ações, configurações e ajuda..."}
            autoComplete="off"
          />
          <button type="button" onClick={onClose} aria-label="Fechar central de comandos"><CloseIcon /></button>
        </header>

        <div className="desktop-command-results" role="listbox" aria-label="Comandos disponíveis">
          {filtered.length ? filtered.map((command, index) => {
            const Icon = iconMap[command.icon];
            return (
              <button
                type="button"
                key={command.id}
                className={index === activeIndex ? "active" : ""}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => void execute(command)}
              >
                <span className="desktop-command-icon"><Icon /></span>
                <span className="desktop-command-copy"><strong>{command.label}</strong><small>{command.description}</small>{command.category ? <em>{command.category}</em> : null}</span>
                {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
              </button>
            );
          }) : (
            <div className="desktop-command-empty"><SearchIcon /><strong>Nenhum comando encontrado</strong><span>Tente outro termo ou navegue pelas configurações.</span></div>
          )}
        </div>

        <footer className="desktop-command-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> fechar</span>
        </footer>
      </section>
    </div>
  );
}
