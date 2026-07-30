# FinnacialUX Desktop 0.7.0

## Novidades

- Importação local de arquivos CSV, OFX, XLSX e XLS.
- Seletores nativos do Windows para abrir e salvar arquivos.
- Exportação em CSV, JSON e Excel, incluindo uma pasta de trabalho completa com múltiplas abas.
- Modelos oficiais em CSV e Excel para organizar dados antes da importação.
- Pacote `.fuxportable` criptografado por senha para transferência entre computadores.
- Verificação SHA-256 do pacote e de cada módulo antes da importação.
- Modos de importação por mesclagem ou substituição integral do espaço financeiro.
- Histórico local de importações, exportações e transferências dentro do banco SQLCipher.
- Snapshot automático antes de importações e opção para desfazer operações reversíveis.

## Segurança e dados

- Pacotes portáteis usam PBKDF2-SHA256 e AES-256-GCM.
- Senhas, PIN, chave SQLCipher e segredos do Stronghold nunca entram no pacote portátil.
- O computador de destino mantém sua própria chave local de criptografia.
- Importações são aplicadas em transação e preservam o estado anterior para recuperação.
- O schema local avança para a versão 5 com histórico de portabilidade protegido pelo SQLCipher.
