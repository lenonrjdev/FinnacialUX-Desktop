# Índice resumido das fases incorporadas

| Fase | Objetivo | Versão | Resultado | Estado atual incorporado em |
|---|---|---:|---|---|
| 1 | Base desktop | 0.1.x | Concluída | `app/`, `components/`, Tauri |
| 2 | Proteção de dados | 0.2.x | Concluída | migrations e `protection.rs` |
| 3 | Segurança local | 0.3.x | Concluída | `security.rs`, Stronghold |
| 4 | Banco SQLCipher | 0.4.x | Concluída | `encrypted_database.rs` |
| 5 | Distribuição e updater | 0.5.0 | Concluída | scripts 04–06 e updater |
| 6 | Experiência e acessibilidade | 0.6.0 | Concluída | componentes desktop/ajuda |
| 7 | Portabilidade | 0.7.0 | Concluída | `portability.rs` e adaptadores |
| 8 | Regressão automatizada | 0.8.x | Concluída | testes e validador consolidado |
| 9 | Continuidade | 0.9.0 | Concluída | `continuity.rs` |
| 10 | Automações | 0.10.0 | Concluída | `automations.rs` |
| 11 | Inteligência local | 0.11.0 | Concluída | `intelligence.rs` |
| 12 | Planejamento | 0.12.0 | Concluída | `planning.rs` |
| 13 | Conciliação e fechamento | 0.13.0 | Concluída | `reconciliation.rs` |
| 14 | Grandes volumes | 0.14.0 | Concluída | `performance.rs` |
| 15 | Rotinas e notificações | 0.15.0 | Concluída | `background_tasks.rs` |
| 16 | Diagnóstico e suporte | 0.16.0 | Concluída | `diagnostics.rs` |
| 17 | Onboarding | 0.17.0 | Concluída | `onboarding.rs` |
| 18 | Release Candidate | 0.18.0-rc.1 | Concluída | motor `release-candidate.mjs` |
| 19 | Primeira estável | 1.0.0 | Concluída | motor de release estável |
| 20 | Manutenção | 1.1.0 | Concluída | manutenção e updater |
| 21 | Backup automático | 1.2.0 | Concluída | motores de backup automático |
| 22 | Recuperação comprovada | 1.3.0 | Concluída | recovery readiness |
| 23 | Backup externo | 1.4.0 | Concluída | `external_backup.rs` |
| 24 | Assinatura Windows confiável | 1.5.0 | Concluída no código; matriz manual pendente | signing/release definitivos e Project Brain |

Os aplicadores, patches e validadores específicos foram removidos depois que seus efeitos foram confirmados no código definitivo e no validador atual.
