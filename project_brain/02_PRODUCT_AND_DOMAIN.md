# Produto e domínio

As rotas em `app/`, os componentes por módulo, os tipos e os documentos persistidos confirmam os módulos abaixo.

- Contas e acessos: conta local, workspace pessoal, preferências e controle de acesso.
- Lançamentos, recebimentos e contas a pagar: fluxo central de movimentações financeiras.
- Cartões, dívidas, assinaturas, orçamentos e metas: compromissos, limites e objetivos.
- Relatórios, visão geral e calendário: agregação, projeções e eventos financeiros.
- Conciliação: importação de extrato, correspondências explicáveis, fechamento mensal, reabertura auditada e evidências.
- Dados e automações: importação/exportação, portabilidade, regras, recorrências, alertas e simulação antes da aplicação.
- Planejamento e inteligência: cenários locais, snapshots, planos, revisões e decisões; não executam pagamentos automaticamente.
- Backup e recuperação: backups cifrados, pontos de recuperação, retenção, restauração validada, redundância externa e ensaio de recuperação.
- Configurações e diagnóstico: segurança local, desempenho, rotinas, updater, manutenção e pacotes de suporte sanitizados.
- Ajuda e onboarding: primeiros passos persistentes, ajuda contextual e busca local.

Regras importantes: valores monetários são tratados sem depender de ponto flutuante nos motores críticos; escritas financeiras respeitam períodos fechados e modo somente leitura; automações exigem simulação/controle; backups externos copiam pacotes já cifrados; dados demonstrativos não substituem persistência real.
