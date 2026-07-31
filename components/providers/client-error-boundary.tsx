"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { recordLocalTechnicalError } from "@/lib/maintenance-preferences";

type ClientErrorBoundaryProps = {
  children: ReactNode;
};

type ClientErrorBoundaryState = {
  error: Error | null;
};

export class ClientErrorBoundary extends Component<
  ClientErrorBoundaryProps,
  ClientErrorBoundaryState
> {
  state: ClientErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ClientErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FinnacialUX frontend error", error, info.componentStack);
    recordLocalTechnicalError(`${error.message}\n${info.componentStack ?? ""}`, "react");
    try {
      window.localStorage.setItem(
        "finnacialux-last-frontend-error",
        JSON.stringify({
          message: error.message,
          stack: error.stack ?? "",
          componentStack: info.componentStack ?? "",
          capturedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // O erro visual continua disponível mesmo sem acesso ao armazenamento local.
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="desktop-fatal-screen" role="alert">
        <section className="desktop-fatal-card">
          <span className="section-eyebrow">Diagnóstico de inicialização</span>
          <h1>O FinnacialUX não conseguiu concluir a interface</h1>
          <p>
            O aplicativo nativo abriu, mas a interface encontrou um erro. Seus dados não foram
            apagados. Recarregue a janela ou volte para a tela de entrada.
          </p>
          <div className="desktop-fatal-actions">
            <button type="button" className="primary-action-button" onClick={() => window.location.reload()}>
              Recarregar aplicativo
            </button>
            <button type="button" className="secondary-action-button" onClick={() => window.location.replace("/login/")}>
              Voltar para o login
            </button>
          </div>
          <details>
            <summary>Detalhes técnicos</summary>
            <pre>{error.message}</pre>
          </details>
        </section>
      </main>
    );
  }
}
