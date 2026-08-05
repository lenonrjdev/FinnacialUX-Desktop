# Dados e banco

O banco atual usa SQLCipher por meio de SQLx/libsqlite3 compilado com `bundled-sqlcipher-vendored-openssl`. O schema `14` está congelado em `release/schema-freeze-14.json`; cada migration possui SHA-256 registrado.

Evolução resumida:

1. usuários, workspaces, preferências, documentos financeiros e reset local;
2. histórico de schema, preferências/histórico de backup e diagnóstico;
3. segurança local e eventos;
4. estado da migração para banco cifrado;
5. operações de portabilidade;
6. continuidade e pontos de recuperação;
7. automações locais;
8. inteligência, cenários e snapshots;
9. planos, revisões e decisões;
10. conciliação, fechamento e evidências;
11. índices e operações de desempenho;
12. fila, execuções e notificações de background;
13. diagnóstico, reparos e suporte;
14. onboarding e ajuda contextual.

Chaves não são persistidas no código nem na release. O núcleo abre, verifica, migra e rekeya o banco; migrations são aplicadas em ordem e testadas contra schemas históricos. Backups e pontos de recuperação usam verificação de integridade, retenção e substituição controlada. Importações registram operações reversíveis quando aplicável. Qualquer schema 15 exige uma nova migration, atualização do freeze, tipos, código Rust, testes e Project Brain.
