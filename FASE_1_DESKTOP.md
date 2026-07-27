# Fase 1 — Fundação Tauri e SQLite local

## Entregue

- projeto Tauri 2 criado;
- interface atual do FinnacialUX Core reaproveitada;
- Next.js configurado para exportação estática;
- SQLite integrado pelo plugin oficial do Tauri;
- migration inicial automática;
- cadastro e login locais;
- perfil e preferências locais;
- múltiplos espaços financeiros locais;
- todos os documentos financeiros persistidos por módulo e espaço;
- recuperação de senha por token local;
- tema claro/escuro persistente;
- scripts Windows para configurar, executar e gerar instalador;
- instalador NSIS preparado para gerar `.exe`.

## Próximas fases

1. **Fase 2 — Arquivos e backups nativos:** exportar/importar backup por seletor do Windows, restauração segura e histórico.
2. **Fase 3 — Segurança local:** Stronghold, PIN, bloqueio por inatividade e endurecimento de CSP/permissões.
3. **Fase 4 — Migração Core → Desktop:** importar backup produzido pelo Core e validar consistência.
4. **Fase 5 — Integração opcional com Core:** sincronização opt-in, resolução de conflitos e modo híbrido.
5. **Fase 6 — Distribuição:** assinatura, atualização automática, instalador final e testes em máquina limpa.
