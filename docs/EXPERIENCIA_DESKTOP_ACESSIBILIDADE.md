# Operação da experiência desktop e acessibilidade

## Estado da janela

O plugin de estado da janela salva e restaura posição, tamanho e maximização. Ao fechar para a bandeja, o FinnacialUX solicita também uma gravação explícita do estado antes de ocultar a janela.

Se a configuração de monitores mudar e o Windows reposicionar a janela, o estado seguinte será atualizado normalmente pelo plugin.

## Bandeja

O menu nativo possui quatro ações:

- **Abrir FinnacialUX** — mostra, restaura e foca a janela principal;
- **Bloquear aplicativo** — mostra a janela e solicita o bloqueio local;
- **Criar backup** — abre o seletor de destino e cria uma cópia criptografada;
- **Encerrar FinnacialUX** — termina o processo e grava o marcador de sessão corretamente.

O clique esquerdo no ícone abre a janela. O fechamento para a bandeja pode ser desativado em Configurações → Desktop.

## Inicialização com o Windows

A opção é controlada pelo plugin nativo de autostart. A interface consulta o estado real do Windows ao abrir, evitando mostrar um valor diferente do registro efetivamente instalado.

## Notificações

A primeira ativação solicita permissão ao sistema. A aplicação usa notificações apenas para confirmações importantes, como backup concluído e permanência na bandeja.

## Preferências acessíveis

As opções são aplicadas no elemento raiz da interface:

- `data-reduce-motion`;
- `data-high-contrast`;
- `data-enhanced-focus`;
- `data-compact-interface`;
- variável CSS `--desktop-text-scale`.

Além da preferência manual de movimento reduzido, o CSS respeita `prefers-reduced-motion` do sistema.

## Diagnóstico de desempenho

As medições são locais e aproximadas. Elas incluem:

- DOM pronto;
- primeiro conteúdo visível;
- latência do comando nativo de diagnóstico;
- tamanho do banco;
- versão do schema;
- confirmação do SQLCipher;
- quantidade de backups;
- espaço livre no volume dos dados.

Não são enviados dados para telemetria ou servidores.

## Atualizações e fechamento para a bandeja

Antes de executar `update.install()`, o updater emite um evento interno que permite o encerramento real da janela. Caso a instalação falhe, a proteção de fechamento para a bandeja é reativada e o marcador de sessão é restaurado.
