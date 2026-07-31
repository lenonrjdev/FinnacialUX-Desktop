# Conciliação e fechamento financeiro

## Fluxo de conciliação

1. Selecione a conta e um extrato CSV ou OFX.
2. Informe os saldos inicial e final apresentados pelo banco.
3. Gere a prévia local.
4. Revise cada sugestão: vincular, criar ou ignorar.
5. Aplique somente depois de conferir o checksum e o resumo.

A pontuação usa valor, distância entre datas, semelhança da descrição e conta. Uma correspondência automática precisa atingir o limite configurado e manter distância segura da segunda opção. Um lançamento existente não pode ser usado por dois itens do mesmo extrato.

## Desfazer

Antes da aplicação, o módulo salva o documento de lançamentos. O desfazer só é permitido quando o checksum do estado posterior ainda corresponde à importação original. Isso evita apagar alterações que ocorreram depois.

## Fechamento mensal

O fechamento considera saldo inicial, movimentos da conta, saldo informado pelo banco, itens não resolvidos e checklist. Depois de fechado, o mês fica protegido no Rust. Interface comum, automações e portabilidade usam a mesma verificação.

## Reabertura

Reabrir exige uma justificativa. O motivo, a data e o evento ficam registrados no histórico local. Depois da reabertura, os lançamentos do período podem ser corrigidos e o mês pode ser fechado novamente.

## Comprovantes

Notas e arquivos de até 5 MB podem ser vinculados a um lançamento. O conteúdo é armazenado como BLOB no SQLCipher, acompanhado de SHA-256. Nenhum comprovante é enviado para serviços externos. Ao exportar, o conteúdo é liberado somente depois que o SHA-256 armazenado confere com os bytes lidos do banco.
