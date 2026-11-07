# Finanças

App pessoal para administrar a vida financeira: saldo, entradas e saídas, extrato por mês e câmbio.
Os dados ficam no aparelho (SQLite) e funcionam sem internet. A sincronização com o Supabase
entra numa fase própria (veja o roteiro abaixo).

## Como rodar

Precisa do **Node 22.13 ou mais novo** (Node 24 ou 26 também servem).

```bash
npm install          # também aplica o patch em patches/ (ver "Observações")
npm start            # abre o Expo; pressione a (Android), i (iOS) ou w (web)
```

Scripts úteis:

| Comando | O que faz |
|---|---|
| `npm run typecheck` | TypeScript em modo strict |
| `npm run lint` | ESLint (config do Expo, com as regras do React Compiler) |
| `npm test` | Testes da lógica: dinheiro, datas, migrations e consultas (usa o `node:sqlite` do próprio Node, nada para compilar) |

## Stack

- **Expo SDK 57** (React Native 0.86, React 19.2), TypeScript strict
- **Expo Router**: rotas por arquivo em `src/app`
- **expo-sqlite + Drizzle ORM**: consultas tipadas; migrations versionadas por `PRAGMA user_version`
- **react-hook-form + Zod**: formulários e validação
- **date-fns** com locale pt-BR
- Fonte **Manrope**, ícones Ionicons

## Estrutura

```
src/
  app/                    rotas (telas)
    (tabs)/               Início, Extrato, botão +, Câmbio, Mais
    transacao/            nova.tsx e [id].tsx (editar)
  components/ui/          design system: Text, Button, Money, MoneyInput, Segmented, Chip,
                          Surface, TextField, DatePickerSheet, ConfirmDialog, Toast, Screen…
  db/
    schema.ts             tabelas (Drizzle)
    migrations.ts         migrations + importação dos dados da versão 1
    seed.ts               conta e categorias padrão (IDs fixos)
    client.tsx            DbProvider, useDb, useDbQuery (consulta que se atualiza sozinha)
  features/
    transactions/         repositório, formulário e item de lista
    catalog/              contas e categorias
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
- **Dados da versão 1**: na primeira abertura, a tabela antiga `transacoes` é convertida
  (valores para centavos, datas para ISO, tipo preservado) e renomeada para
  `legacy_transacoes_v1` como cópia de segurança. Transações com valor zero são ignoradas.

## Observações

- `patches/expo-sqlite+*.patch` corrige um bug do expo-sqlite **na web**: as chamadas
  síncronas cortavam qualquer resultado com mais de 255 bytes. Não afeta Android/iOS.
  Vale remover quando o expo-sqlite publicar a correção.
- Na web as preferências (tema, ocultar valores) usam `localStorage`; no celular, o kv-store do expo-sqlite.

## Roteiro

- [x] **Fase 1, fundação**: SDK 57, TypeScript, Expo Router, banco com migrations, design system,
      telas atuais refeitas, bugs da v1 corrigidos, importação dos dados antigos
- [ ] **Fase 2**: contas (corrente, poupança, carteira…), saldo por conta, transferências,
      gerenciar categorias e subcategorias, filtros por conta e categoria
- [ ] **Fase 3**: cartões de crédito, faturas por ciclo, limite disponível, compras parceladas
- [ ] **Fase 4**: contas a pagar e a receber, recorrências, notificações de vencimento
- [ ] **Fase 5**: dashboard novo, orçamentos por categoria, metas, backup/exportação, biometria
- [ ] **Sync**: login e sincronização com o Supabase (fila local + `updated_at`, RLS por usuário)
