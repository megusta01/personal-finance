# Finanças

App pessoal para administrar a vida financeira: contas com saldo próprio, transferências,
cartões de crédito (faturas, limite, compras parceladas), contas a pagar e a receber,
recorrências com lembretes, categorias e subcategorias, extrato por mês com filtros, relatórios,
orçamentos por categoria, metas, backup/planilha, bloqueio com biometria e câmbio.
Os dados ficam no aparelho (SQLite) e funcionam sem internet. A sincronização com o Supabase
entra numa fase própria (veja o roteiro abaixo).

## Como rodar

Precisa do **Node 22.13 ou mais novo** (Node 24 ou 26 também servem).

```bash
npm install
npm start            # abre o Expo; pressione a (Android), i (iOS) ou w (web)
```

Scripts úteis:

| Comando | O que faz |
|---|---|
| `npm run typecheck` | TypeScript em modo strict |
| `npm run lint` | ESLint (config do Expo, com as regras do React Compiler) |
| `npm test` | Testes da lógica: dinheiro, datas, migrations e consultas (usa o `node:sqlite` do próprio Node, nada para compilar) |

## Stack

- **Expo SDK 58** (React Native 0.88, React 19.3), TypeScript strict
- **Expo Router**: rotas por arquivo em `src/app`
- **expo-sqlite + Drizzle ORM**: consultas tipadas; migrations versionadas por `PRAGMA user_version`
- **react-hook-form + Zod**: formulários e validação
- **date-fns** com locale pt-BR
- Fonte **Manrope**, ícones Ionicons

## Estrutura

```
src/
  app/                    rotas (telas)
    (tabs)/               Início, Extrato, botão +, Contas, Mais
    transacao/            nova.tsx (?tipo=expense|income|transfer&conta=id) e [id].tsx (editar)
    conta/                [id] (detalhe com extrato), nova, editar/[id], ajustar/[id]
    categorias/           lista, nova (?tipo=&pai=), [id] (editar)
    cartao/               [id] (faturas e limite), novo, editar/[id], pagar/[id] (?fatura=AAAA-MM)
    pagamentos/           a pagar e a receber (index) e pagar/[id] (marcar como pago)
    recorrencias.tsx      lista de recorrências; recorrencia/[id] edita uma
    relatorios.tsx        gastos/receitas por categoria, ritmo do mês, 12 meses, maiores gastos
    orcamentos.tsx        orçamentos do mês; orcamento/editar (?categoria=id)
    metas.tsx             metas; meta/[id] (detalhe), meta/editar (?id), meta/movimentar/[id] (?tipo=guardar|retirar)
    cambio.tsx            cotações e conversor
  components/ui/          design system: Text, Button, Money, MoneyInput, Segmented, Chip,
                          Surface, TextField, DatePickerSheet, ConfirmDialog, Toast, Screen…
  db/
    schema.ts             tabelas (Drizzle)
    migrations.ts         migrations + importação dos dados da versão 1
    seed.ts               conta e categorias padrão (IDs fixos)
    client.tsx            DbProvider, useDb, useDbQuery (consulta que se atualiza sozinha)
  features/
    transactions/         repositório, formulário (despesa/receita/transferência), extrato (TransactionFeed)
    accounts/             saldo por conta, criar/editar/arquivar, ajuste de saldo
    categories/           árvore de categorias e subcategorias, criar/editar/arquivar
    bills/                contas em aberto, marcar pago, resumo do mês e saldo previsto
    recurrences/          schedule.ts (datas), geração das ocorrências, editar/encerrar/pausar
    reminders/            plan.ts (quais lembretes), notificações locais, BackgroundJobs
    cards/                cycle.ts (regras de fechamento/vencimento/parcelas), cartões, compras, faturas, pagamento
    reports/              consultas dos relatórios e gráficos (ShareBar, PaceChart, FlowChart)
    budgets/              orçamentos: situação, ritmo projetado, barra e selo
    goals/                metas: progresso, quanto guardar por mês, entradas e retiradas
    backup/               backup JSON (criar, validar, restaurar), planilha CSV, salvar/abrir arquivos
    security/             bloqueio com biometria (LockGate) e autenticação
    catalog/              metadados locais (app_meta)
    home/                 cartão de saldo e gráfico mensal
    rates/                cotações (AwesomeAPI)
  lib/                    money.ts, dates.ts, prefs.ts
  theme/                  tokens (cores claro/escuro, tipografia, espaçamento) e ThemeProvider
```

## Decisões importantes

- **Dinheiro em centavos inteiros** (`amount_cents`). Nada de `REAL`/float.
- **Datas de lançamento como `AAAA-MM-DD`**; carimbos de tempo em ISO 8601 UTC.
- **Preparado para sync**: IDs em texto (UUID ou fixos), `created_at`, `updated_at` e
  `deleted_at` (exclusão suave) em todas as tabelas sincronizáveis. Conta e categorias
  padrão têm IDs fixos, então não duplicam quando dois aparelhos sincronizarem.
- **Migrations antes de qualquer tela**: o `SQLiteProvider` só libera o app depois do `migrate()`.
- **Saldo por conta** = saldo inicial + receitas − despesas − transferências enviadas + recebidas
  (só lançamentos pagos). O saldo total soma as contas ativas marcadas para entrar no total.
- **Transferências** não contam como entrada nem saída no total do mês; na tela de uma conta,
  contam como entrada/saída daquela conta.
- **Ajustar saldo** lança a diferença na categoria de sistema "Ajuste de saldo". Ela muda o saldo,
  mas fica fora dos totais de entradas/saídas e do gráfico.
- **Subcategorias** herdam tipo, ícone e cor da categoria pai. Filtrar pela categoria pai inclui as subcategorias.
- **Arquivar x excluir**: contas e categorias com movimentações só podem ser arquivadas (somem das
  listas de escolha, o histórico fica). Sempre sobra pelo menos uma conta ativa.
- **Cartões de crédito**
  - A fatura é identificada pelo mês de vencimento ("fatura de dezembro" vence em dezembro).
  - Compras a partir do dia de fechamento entram na fatura seguinte (melhor dia de compra = fechamento).
    Dia 31 em mês curto vira o último dia do mês.
  - Compra parcelada vira uma linha por parcela, uma por fatura; a sobra de centavos vai na 1ª parcela.
    Editar regrava as mesmas linhas (IDs `grupo-1`, `grupo-2`…); excluir apaga todas as parcelas.
  - Compras no cartão contam como despesa do mês (na data de cada parcela) e não mexem no saldo das contas.
  - Pagar a fatura tira da conta e abate a fatura; não conta como despesa (as compras já contaram).
  - Limite usado = compras (inclusive parcelas futuras) − estornos − pagamentos.
  - Situação da fatura: futura, aberta, fechada, paga ou vencida.
- **A pagar e a receber**: lançamento com situação "a pagar" (ou "a receber") tem vencimento,
  não entra no saldo nem nos totais até ser marcado como pago. Ao pagar, dá para ajustar valor,
  data e conta; o vencimento continua guardado.
- **Recorrências**: semanal, mensal ou anual (a cada N), com fim opcional por data ou número de vezes.
  O app cria as ocorrências dos próximos 45 dias (no cartão, só até hoje) com IDs previsíveis
  (`recorrência@data`), ao abrir e ao voltar para o app. O que já existe nunca é sobrescrito:
  ocorrência editada ou excluída continua como a pessoa deixou. "Esta e as próximas" refaz só o que
  está em aberto; o que já foi pago não muda. Débito automático marca como pago sozinho no dia.
- **Saldo previsto para o fim do mês** = saldo de hoje + a receber − a pagar (até o fim do mês)
  − faturas de cartão em aberto que vencem no mês.
- **Lembretes** (notificações locais; funcionam no Expo Go): no dia do vencimento e, se quiser, N dias
  antes, no horário escolhido. Vale para contas, recebimentos e faturas. Vencidas viram um aviso-resumo.
  No máximo 60 agendados (limite do iOS: 64). Com "Ocultar valores", os avisos não mostram valores.
- **Relatórios** usam só lançamentos pagos; ficam de fora transferências, pagamentos de fatura,
  ajustes de saldo e contas ainda a pagar. Compras no cartão entram na data de cada parcela.
  Subcategorias somam na categoria pai; tocar na categoria mostra o detalhe.
- **Cores dos gráficos**: azul (entradas) e âmbar (saídas), testados para daltonismo; vermelho e verde
  aparecem só em textos que já têm sinal (+/−) ou seta.
- **Orçamentos** são por categoria principal de despesa (incluem as subcategorias) e valem todo mês.
  Situação: dentro (< 80%), atenção (80–100%) e estourou (> 100%), sempre com ícone e texto.
  O "ritmo" projeta o gasto até o fim do mês pela média diária até hoje.
- **Metas** podem ser acompanhadas por registro manual (guardar/retirar) ou pelo saldo de uma conta.
  Com prazo, o app calcula quanto guardar por mês. Guardar numa meta não tira dinheiro de nenhuma conta.
- **Backup** é um JSON com todas as tabelas (inclusive excluídas, para o sync futuro) e a versão do esquema.
  Restaurar valida o arquivo, substitui tudo numa transação e desfaz se algo der errado; aceita backups
  de versões antigas do esquema. A **planilha** é CSV no padrão brasileiro (`;`, vírgula decimal, UTF-8 com BOM),
  abre direto no Excel.
- **Bloqueio**: Face ID/digital (ou o PIN do aparelho). Pede de novo depois de 1 minuto fora do app e
  cobre a tela no alternador de apps. Só liga se o aparelho tiver biometria ou senha configurada.
- **Dados da versão 1**: na primeira abertura, a tabela antiga `transacoes` é convertida
  (valores para centavos, datas para ISO, tipo preservado) e renomeada para
  `legacy_transacoes_v1` como cópia de segurança. Transações com valor zero são ignoradas.

## Observações

- Na web as preferências (tema, ocultar valores) usam `localStorage`; no celular, o kv-store do expo-sqlite.
- Na web, o expo-sqlite tem um tempo-limite curto para consultas síncronas e às vezes acusa
  "Sync operation timeout" em recargas rápidas. No Android/iOS o acesso é direto e isso não acontece.
- O bloqueio com biometria não existe na web. Backup e planilha na web viram download, e restaurar abre o seletor de arquivo.
- No Expo Go o Face ID usa a permissão do próprio Expo Go; num build próprio, a mensagem configurada no `app.json`.

## Roteiro

- [x] **Fase 1, fundação**: SDK 58, TypeScript, Expo Router, banco com migrations, design system,
      telas atuais refeitas, bugs da v1 corrigidos, importação dos dados antigos
- [x] **Fase 2**: contas (corrente, poupança, carteira…), saldo por conta, transferências,
      ajuste de saldo, gerenciar categorias e subcategorias, filtros por conta e categoria
- [x] **Fase 3**: cartões de crédito, faturas por ciclo, limite disponível, compras parceladas,
      estornos, pagamento total ou parcial da fatura
- [x] **Fase 4**: contas a pagar e a receber, recorrências (com débito automático e valor variável),
      lembretes de vencimento, saldo previsto para o fim do mês
- [x] **Fase 5**: dashboard novo, orçamentos por categoria, metas, backup/exportação, biometria
- [ ] **Sync**: login e sincronização com o Supabase (fila local + `updated_at`, RLS por usuário)
