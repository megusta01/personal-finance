# Finanças

App pessoal para administrar a vida financeira: contas com saldo próprio, transferências,
categorias e subcategorias, extrato por mês com filtros e câmbio.
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
- **Dados da versão 1**: na primeira abertura, a tabela antiga `transacoes` é convertida
  (valores para centavos, datas para ISO, tipo preservado) e renomeada para
  `legacy_transacoes_v1` como cópia de segurança. Transações com valor zero são ignoradas.

## Observações

- Na web as preferências (tema, ocultar valores) usam `localStorage`; no celular, o kv-store do expo-sqlite.

## Roteiro

- [x] **Fase 1, fundação**: SDK 58, TypeScript, Expo Router, banco com migrations, design system,
      telas atuais refeitas, bugs da v1 corrigidos, importação dos dados antigos
- [x] **Fase 2**: contas (corrente, poupança, carteira…), saldo por conta, transferências,
      ajuste de saldo, gerenciar categorias e subcategorias, filtros por conta e categoria
- [ ] **Fase 3**: cartões de crédito, faturas por ciclo, limite disponível, compras parceladas
- [ ] **Fase 4**: contas a pagar e a receber, recorrências, notificações de vencimento
- [ ] **Fase 5**: dashboard novo, orçamentos por categoria, metas, backup/exportação, biometria
- [ ] **Sync**: login e sincronização com o Supabase (fila local + `updated_at`, RLS por usuário)
