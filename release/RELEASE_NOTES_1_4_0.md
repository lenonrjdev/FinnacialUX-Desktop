# FinnacialUX Desktop 1.4.0

## Backup externo criptografado

- destino externo configurável por pasta;
- espelhamento após backup automático, na inicialização ou ao retornar ao aplicativo;
- cópia atômica com arquivo temporário;
- SHA-256 da origem e do destino;
- sidecar `.sha256` por pacote;
- retenção de 3, 5, 10 ou 20 cópias;
- detecção de mídia desconectada e permissão de gravação;
- identificação de volume secundário e pastas sincronizadas;
- bloqueio de pacotes sem criptografia;
- histórico técnico sanitizado;
- nenhuma chave do Stronghold é copiada.

O schema SQLCipher permanece congelado na versão 14.
