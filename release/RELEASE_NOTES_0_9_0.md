# FinnacialUX Desktop 0.9.0

## Continuidade e recuperação local

- adiciona o schema 6 com preferências, pontos e eventos de continuidade;
- cria snapshots SQLCipher protegidos antes de migrations;
- cria pontos `.fuxbackup` diários somente após verificação saudável e com chave do dispositivo;
- valida checksums e integridade antes de verificar ou restaurar arquivos;
- restaura bancos por staging atômico e rollback automático;
- cria backup de segurança antes de qualquer recuperação;
- bloqueia gravações financeiras no núcleo Rust diante de falhas de integridade;
- exige nova validação antes de sair do modo somente leitura;
- aplica retenção por quantidade e idade sem remover pontos protegidos;
- adiciona a área Configurações → Continuidade e um banner global de proteção;
- amplia os testes para schema 6, retenção, estado somente leitura e SQLCipher;
- mantém a árvore npm auditada em 0 vulnerabilidades altas ou críticas.
