# FinnacialUX Desktop 0.16.0

## Diagnóstico, auditoria e suporte local

Esta versão consolida a manutenção técnica do aplicativo sem adicionar novos módulos financeiros.

### Destaques

- central de diagnóstico com pontuação explicável;
- validação de SQLCipher, schema, Stronghold e pastas locais;
- teste transacional de leitura e escrita com rollback;
- ensaio de restauração em snapshot temporário;
- saúde de backups e pontos de recuperação;
- detecção de rotinas travadas e leases expirados;
- reparos seguros e auditáveis;
- histórico de auditorias e reparos;
- pacote `.fuxsupport` com SHA-256;
- logs com caminhos, e-mails e tokens sanitizados;
- funcionamento de leitura no modo protegido.

### Privacidade

O pacote de suporte não contém chaves, senhas, PIN, saldos, descrições ou documentos financeiros.

### Banco de dados

- versão do aplicativo: `0.16.0`;
- schema SQLCipher: `13`;
- seis novas tabelas técnicas de diagnóstico e suporte.

### Dependências

Nenhuma dependência npm ou crate Rust foi adicionada.
