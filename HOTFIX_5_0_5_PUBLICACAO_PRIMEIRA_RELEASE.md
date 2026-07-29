# Hotfix 5.0.5 - Publicacao da primeira release

## Problema corrigido

Na primeira publicacao, `gh release view desktop-v0.5.0` retorna codigo 1 e escreve `release not found` porque a release ainda nao existe.

No Windows PowerShell 5.1, a mensagem escrita em stderr pelo GitHub CLI entra no fluxo de erro. Como o script utilizava `$ErrorActionPreference = "Stop"`, a execucao era encerrada antes de verificar `$LASTEXITCODE` e antes de chamar `gh release create`.

## Correcao

- trata `release not found` como resultado normal da verificacao;
- cria a release quando a tag ainda nao existe;
- atualiza os arquivos com `--clobber` quando ela ja existe;
- informa explicitamente o repositorio `lenonrjdev/FinnacialUX-Desktop`;
- tenta obter o repositorio de `release/updater-config.json` antes do fallback;
- localiza `gh.exe` mesmo quando o PowerShell ainda esta com PATH antigo;
- valida os seis arquivos locais obrigatorios;
- confirma acesso ao repositorio antes do upload;
- valida a release e a quantidade de assets ao final.

## Arquivo alterado

- `scripts/06_PUBLICAR_RELEASE_GITHUB.ps1`

## Aplicacao

Extraia o ZIP na raiz do projeto e substitua o arquivo existente. Depois execute:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\06_PUBLICAR_RELEASE_GITHUB.cmd
```

Nao gere novamente o instalador e nao execute `05_GERAR_RELEASE.cmd`.
