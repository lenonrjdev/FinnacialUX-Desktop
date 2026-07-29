# FinnacialUX Desktop — Hotfix 5.0.6

## Publicação da release sem `--jq`

Este hotfix corrige a publicação da primeira release no Windows PowerShell 5.1.

## Problema corrigido

O script utilizava `gh ... --jq` com uma expressão textual. Ao encaminhar o argumento para o executável nativo `gh.exe`, o Windows PowerShell removia as aspas externas e o jq recebia uma expressão inválida:

```text
Repositorio confirmado: \(.nameWithOwner) [\(.visibility)]
```

A publicação era interrompida mesmo com autenticação e acesso ao repositório válidos.

## Correção

O script agora solicita JSON puro ao GitHub CLI e interpreta a resposta com `ConvertFrom-Json` no próprio PowerShell.

Foram corrigidos dois pontos:

- confirmação de acesso ao repositório;
- validação final da release publicada.

A detecção de release inexistente e a criação da primeira tag continuam preservadas.

## Aplicação

Extraia o ZIP na raiz do projeto e permita substituir:

```text
scripts\06_PUBLICAR_RELEASE_GITHUB.ps1
```

Depois execute:

```powershell
.\06_PUBLICAR_RELEASE_GITHUB.cmd
```

Não é necessário gerar novamente o instalador ou finalizar novamente a pasta `releases\0.6.0`.
