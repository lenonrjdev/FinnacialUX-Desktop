# Privacidade — FinnacialUX Desktop

O FinnacialUX Desktop foi projetado como aplicativo offline-first.

## Dados locais

Contas, lançamentos, anexos, planejamentos, backups e preferências permanecem no computador do usuário. O banco local usa SQLCipher e as credenciais do dispositivo são protegidas pelo Stronghold.

## Rede

O aplicativo não envia telemetria de uso. A rede pode ser utilizada quando o usuário verifica atualizações assinadas, abre um endereço externo ou executa uma ação explicitamente integrada a um serviço externo.

## Diagnóstico e suporte

Pacotes `.fuxsupport` são criados apenas por solicitação do usuário. Eles contêm versões, estados técnicos, contagens e logs sanitizados; não incluem chaves, senhas, saldos ou descrições de lançamentos.

## Notificações

Alertas e rotinas são processados localmente. As notificações nativas exibem resumos e respeitam as preferências e o horário silencioso.

## Controle do usuário

O usuário pode exportar backups, restaurar cópias, desativar rotinas e entrar em modo somente leitura. A remoção definitiva dos arquivos locais deve ser feita conscientemente pelas ferramentas do sistema operacional, após confirmar que existe um backup criptografado quando necessário.
