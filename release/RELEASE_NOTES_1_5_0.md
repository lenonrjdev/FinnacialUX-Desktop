# FinnacialUX Desktop 1.5.0

## Assinatura oficial do Windows

- Pipeline Authenticode obrigatório para releases estáveis.
- Assinatura do executável principal e do instalador NSIS.
- SHA-256 obrigatório para arquivo e timestamp.
- Verificação pela política padrão de autenticação do Windows (`/pa`).
- Conferência do publisher esperado e do carimbo de tempo.
- Suporte a certificado no Windows Certificate Store, PFX externo e comando em HSM/nuvem.
- Bloqueio de publicação quando uma assinatura estiver ausente, expirada, sem timestamp ou com identidade divergente.
- PFX, senhas e chaves privadas permanecem fora do Git e dos artefatos publicados.

## Compatibilidade

- Atualização direta da versão 1.4.0.
- Schema SQLCipher 14 permanece congelado.
- Nenhuma migration nova e nenhuma dependência de runtime adicionada.
