# Distribuição e assinaturas

O FinnacialUX usa duas proteções diferentes:

1. **Assinatura do updater Tauri:** obrigatória para validar que a atualização foi criada com a chave privada correta. Essa estrutura está implementada na Fase 5.
2. **Assinatura Authenticode do Windows:** identifica publicamente o editor e reduz avisos de “Editor desconhecido”. Ela exige um certificado ou serviço externo e não pode ser inventada pelo projeto.

Guarde a chave do updater em pelo menos dois locais seguros. Perder essa chave impede a publicação de atualizações compatíveis para instalações existentes.

Para uma distribuição pública profissional, adquira uma solução de assinatura de código, instale o certificado no Windows e execute `07_CONFIGURAR_ASSINATURA_WINDOWS.cmd`. O script cria uma configuração com `certificateThumbprint`, SHA-256 e timestamp; a chave privada continua protegida pelo armazenamento do certificado. Também é possível usar um `signCommand` ou serviço de assinatura no pipeline. A assinatura Authenticode é independente do arquivo `.sig` do updater.

O instalador permanece no modo `currentUser`, portanto não exige administrador. Atualizações e reinstalações preservam o banco SQLCipher, o Stronghold e os backups nas pastas de dados do usuário. A desinstalação padrão também preserva esses dados para evitar perda acidental; a exclusão definitiva deve ser feita somente por uma ação explícita dentro do aplicativo ou por procedimento documentado.
