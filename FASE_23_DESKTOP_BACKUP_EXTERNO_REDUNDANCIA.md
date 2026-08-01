# Fase 23 — Backup externo criptografado e redundância real

Versão `1.4.0`, schema SQLCipher `14` congelado.

A fase cria uma segunda localização para os pacotes criptografados, com cópia atômica, SHA-256, sidecar, retenção, detecção de mídia desconectada e integração ao backup automático. Nenhuma chave criptográfica é copiada e nenhuma migration é adicionada.
