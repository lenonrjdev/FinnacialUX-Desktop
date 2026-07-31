"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BookIcon, CheckIcon, CloseIcon, SearchIcon } from "@/components/shared/icons";
import type { ContextualHelpTopic } from "@/types/onboarding";

export function ContextualHelpPanel({
  open,
  topic,
  onClose,
  onOpenSearch,
}: {
  open: boolean;
  topic: ContextualHelpTopic;
  onClose: () => void;
  onOpenSearch: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="context-help-overlay" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <aside
        ref={panelRef}
        className="context-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-help-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <header>
          <span><BookIcon /></span>
          <div><small>Ajuda desta tela</small><h2 id="context-help-title">{topic.title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Fechar ajuda desta tela"><CloseIcon /></button>
        </header>
        <p className="context-help-summary">{topic.summary}</p>
        <ol className="context-help-steps">
          {topic.steps.map((step) => <li key={step}><CheckIcon /><span>{step}</span></li>)}
        </ol>
        <section className="context-help-related">
          <h3>Atalhos relacionados</h3>
          {topic.related.map((item) => <Link href={item.href} key={item.href} onClick={onClose}>{item.label}</Link>)}
        </section>
        <footer>
          <button type="button" onClick={() => { onClose(); onOpenSearch(); }}><SearchIcon /> Buscar em toda a ajuda</button>
          <Link href="/ajuda" onClick={onClose}><BookIcon /> Abrir central completa</Link>
        </footer>
      </aside>
    </div>
  );
}
