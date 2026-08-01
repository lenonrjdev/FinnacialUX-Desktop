# FinnacialUX Desktop 1.2.0

## Backup automático real

- executa a política nativa ao iniciar, ao retornar para o aplicativo e em intervalos locais;
- respeita as frequências diária, semanal e mensal já salvas no SQLCipher;
- usa Stronghold quando a criptografia do dispositivo está habilitada;
- impede duplicações antes do prazo pelo próprio núcleo Rust;
- aplica retenção automática aos arquivos antigos;
- adiciona painel de saúde, próxima periodicidade e histórico técnico local;
- permite avisos locais de sucesso e falha;
- mantém restauração manual, confirmada e protegida.

## Segurança e compatibilidade

- schema SQLCipher 14 permanece congelado;
- nenhuma dependência npm ou crate Rust nova;
- nenhuma telemetria ou sincronização externa;
- erros locais têm caminhos, e-mails e segredos sanitizados;
- atualização promovida da versão estável 1.1.0.
