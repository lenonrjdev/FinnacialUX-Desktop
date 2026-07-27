# FinnacialUX Desktop — Hotfix 1.0.1

Este hotfix corrige os sete erros de TypeScript identificados na configuração inicial e impede que os scripts anunciem sucesso quando `npm`, TypeScript, Next.js, Cargo ou Tauri terminarem com erro.

## Correções

- estados de observação de assinaturas e dívidas agora aceitam texto editável;
- campos de categoria dos formulários são tratados como `string`;
- o salt PBKDF2 é convertido para um `BufferSource` compatível com o TypeScript atual;
- Node.js mínimo definido como `22.13.0`;
- scripts PowerShell interrompem imediatamente em qualquer erro;
- mensagens específicas orientam a instalação do linker C++ no Windows.

## Depois de aplicar

1. Atualize o Node.js para 22.13.0 ou superior.
2. Instale o Visual Studio Build Tools 2022 com **Desenvolvimento para desktop com C++**.
3. Feche e abra o PowerShell.
4. Execute `./01_CONFIGURAR_DESKTOP.cmd` novamente.
5. Somente quando aparecer `Configuração validada com sucesso`, execute `./02_RODAR_DESKTOP.cmd`.
