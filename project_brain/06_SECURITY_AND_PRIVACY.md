# Segurança e privacidade

- Local-first: dados financeiros permanecem no dispositivo.
- Banco: SQLCipher; o arquivo não deve expor cabeçalho SQLite em claro.
- Cofre: Stronghold usa salt no diretório local da aplicação; credenciais também usam primitivas como Argon2, PBKDF2, AES-GCM e zeroização.
- Segredos: chaves do updater, PFX, senhas, `.env` e configuração local de assinatura nunca entram no Git.
- Authenticode: releases oficiais exigem SHA-256, timestamp RFC 3161, publisher esperado e verificação do executável/instalador.
- Updater: a assinatura Tauri é distinta do certificado Authenticode; sua chave privada fica fora do projeto.
- Logs e suporte: motores de diagnóstico removem caminhos, e-mails, tokens longos e conteúdo financeiro antes da exportação.
- Permissões: capabilities Tauri limitam a janela principal e os plugins necessários.

É proibido registrar segredos no Project Brain, desativar gates de assinatura, trocar chaves silenciosamente, exportar bancos reais ou aceitar mocks como evidência de segurança. O publisher operacional esperado na release 1.5.0 é `CN=Ateliux Solucoes Digitais`; o valor privado do certificado não é documentado aqui.
