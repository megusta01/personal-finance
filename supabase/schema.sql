-- Finanças: tabelas da nuvem para a sincronização.
-- GERADO AUTOMATICAMENTE por src/features/sync/remoteSchema.ts (não edite à mão;
-- rode `npm run supabase:sql` depois de mudar as tabelas do app).
--
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode rodar de novo a cada versão nova do app: só cria o que falta.

-- "A última edição vence": se a nuvem já tem uma versão mais nova do registro,
-- a gravação mais antiga é ignorada. Toda gravação aceita ganha um carimbo novo do servidor.
create or replace function public.finance_sync_row() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.user_id := old.user_id;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- accounts
create table if not exists public.accounts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
alter table public.accounts add column if not exists "name" text not null;
alter table public.accounts add column if not exists "type" text not null;
alter table public.accounts add column if not exists "institution" text;
alter table public.accounts add column if not exists "color" text not null;
alter table public.accounts add column if not exists "icon" text not null;
alter table public.accounts add column if not exists "initial_balance_cents" bigint default 0 not null;
alter table public.accounts add column if not exists "include_in_total" bigint default 1 not null;
alter table public.accounts add column if not exists "sort_order" bigint default 0 not null;
alter table public.accounts add column if not exists "archived_at" text;
alter table public.accounts add column if not exists "created_at" text not null;
alter table public.accounts add column if not exists "updated_at" text not null;
alter table public.accounts add column if not exists "deleted_at" text;
create index if not exists accounts_pull_idx on public.accounts (user_id, server_updated_at, id);
alter table public.accounts enable row level security;
drop policy if exists "accounts: ler as próprias" on public.accounts;
create policy "accounts: ler as próprias" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "accounts: criar as próprias" on public.accounts;
create policy "accounts: criar as próprias" on public.accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "accounts: alterar as próprias" on public.accounts;
create policy "accounts: alterar as próprias" on public.accounts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.accounts from anon;
grant select, insert, update on public.accounts to authenticated;
drop trigger if exists accounts_sync on public.accounts;
create trigger accounts_sync before insert or update on public.accounts
  for each row execute function public.finance_sync_row();

-- categories
create table if not exists public.categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
alter table public.categories add column if not exists "name" text not null;
alter table public.categories add column if not exists "kind" text not null;
alter table public.categories add column if not exists "icon" text not null;
alter table public.categories add column if not exists "color" text not null;
alter table public.categories add column if not exists "parent_id" text;
alter table public.categories add column if not exists "sort_order" bigint default 0 not null;
alter table public.categories add column if not exists "archived_at" text;
alter table public.categories add column if not exists "created_at" text not null;
alter table public.categories add column if not exists "updated_at" text not null;
alter table public.categories add column if not exists "deleted_at" text;
alter table public.categories add column if not exists "is_system" bigint default 0 not null;
create index if not exists categories_pull_idx on public.categories (user_id, server_updated_at, id);
alter table public.categories enable row level security;
drop policy if exists "categories: ler as próprias" on public.categories;
create policy "categories: ler as próprias" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "categories: criar as próprias" on public.categories;
create policy "categories: criar as próprias" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "categories: alterar as próprias" on public.categories;
create policy "categories: alterar as próprias" on public.categories
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.categories from anon;
grant select, insert, update on public.categories to authenticated;
drop trigger if exists categories_sync on public.categories;
create trigger categories_sync before insert or update on public.categories
  for each row execute function public.finance_sync_row();

-- credit_cards
create table if not exists public.credit_cards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
alter table public.credit_cards add column if not exists "name" text not null;
alter table public.credit_cards add column if not exists "brand" text not null;
alter table public.credit_cards add column if not exists "last_digits" text;
alter table public.credit_cards add column if not exists "color" text not null;
alter table public.credit_cards add column if not exists "limit_cents" bigint not null;
alter table public.credit_cards add column if not exists "closing_day" bigint not null;
alter table public.credit_cards add column if not exists "due_day" bigint not null;
alter table public.credit_cards add column if not exists "payment_account_id" text;
alter table public.credit_cards add column if not exists "sort_order" bigint default 0 not null;
alter table public.credit_cards add column if not exists "archived_at" text;
alter table public.credit_cards add column if not exists "created_at" text not null;
alter table public.credit_cards add column if not exists "updated_at" text not null;
alter table public.credit_cards add column if not exists "deleted_at" text;
create index if not exists credit_cards_pull_idx on public.credit_cards (user_id, server_updated_at, id);
alter table public.credit_cards enable row level security;
drop policy if exists "credit_cards: ler as próprias" on public.credit_cards;
create policy "credit_cards: ler as próprias" on public.credit_cards
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "credit_cards: criar as próprias" on public.credit_cards;
create policy "credit_cards: criar as próprias" on public.credit_cards
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "credit_cards: alterar as próprias" on public.credit_cards;
create policy "credit_cards: alterar as próprias" on public.credit_cards
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.credit_cards from anon;
grant select, insert, update on public.credit_cards to authenticated;
drop trigger if exists credit_cards_sync on public.credit_cards;
create trigger credit_cards_sync before insert or update on public.credit_cards
  for each row execute function public.finance_sync_row();

-- recurrences
create table if not exists public.recurrences (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
alter table public.recurrences add column if not exists "kind" text not null;
alter table public.recurrences add column if not exists "amount_cents" bigint not null;
alter table public.recurrences add column if not exists "variable_amount" bigint default 0 not null;
alter table public.recurrences add column if not exists "description" text not null;
alter table public.recurrences add column if not exists "category_id" text;
alter table public.recurrences add column if not exists "account_id" text;
alter table public.recurrences add column if not exists "card_id" text;
alter table public.recurrences add column if not exists "frequency" text not null;
alter table public.recurrences add column if not exists "interval_n" bigint default 1 not null;
alter table public.recurrences add column if not exists "start_on" text not null;
alter table public.recurrences add column if not exists "end_on" text;
alter table public.recurrences add column if not exists "max_count" bigint;
alter table public.recurrences add column if not exists "auto_pay" bigint default 0 not null;
alter table public.recurrences add column if not exists "notes" text;
alter table public.recurrences add column if not exists "paused_at" text;
alter table public.recurrences add column if not exists "generated_until" text;
alter table public.recurrences add column if not exists "created_at" text not null;
alter table public.recurrences add column if not exists "updated_at" text not null;
alter table public.recurrences add column if not exists "deleted_at" text;
create index if not exists recurrences_pull_idx on public.recurrences (user_id, server_updated_at, id);
alter table public.recurrences enable row level security;
drop policy if exists "recurrences: ler as próprias" on public.recurrences;
create policy "recurrences: ler as próprias" on public.recurrences
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "recurrences: criar as próprias" on public.recurrences;
create policy "recurrences: criar as próprias" on public.recurrences
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "recurrences: alterar as próprias" on public.recurrences;
create policy "recurrences: alterar as próprias" on public.recurrences
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.recurrences from anon;
grant select, insert, update on public.recurrences to authenticated;
drop trigger if exists recurrences_sync on public.recurrences;
create trigger recurrences_sync before insert or update on public.recurrences
  for each row execute function public.finance_sync_row();

-- transactions
create table if not exists public.transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
alter table public.transactions add column if not exists "kind" text not null;
alter table public.transactions add column if not exists "amount_cents" bigint not null;
alter table public.transactions add column if not exists "description" text not null;
alter table public.transactions add column if not exists "account_id" text;
alter table public.transactions add column if not exists "to_account_id" text;
alter table public.transactions add column if not exists "category_id" text;
alter table public.transactions add column if not exists "occurred_on" text not null;
alter table public.transactions add column if not exists "status" text default 'paid' not null;
alter table public.transactions add column if not exists "notes" text;
alter table public.transactions add column if not exists "origin" text default 'app' not null;
alter table public.transactions add column if not exists "card_id" text;
alter table public.transactions add column if not exists "invoice_month" text;
alter table public.transactions add column if not exists "installment_group_id" text;
alter table public.transactions add column if not exists "installment_number" bigint;
alter table public.transactions add column if not exists "installment_count" bigint;
alter table public.transactions add column if not exists "created_at" text not null;
alter table public.transactions add column if not exists "updated_at" text not null;
alter table public.transactions add column if not exists "deleted_at" text;
alter table public.transactions add column if not exists "due_on" text;
alter table public.transactions add column if not exists "recurrence_id" text;
create index if not exists transactions_pull_idx on public.transactions (user_id, server_updated_at, id);
alter table public.transactions enable row level security;
drop policy if exists "transactions: ler as próprias" on public.transactions;
create policy "transactions: ler as próprias" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "transactions: criar as próprias" on public.transactions;
create policy "transactions: criar as próprias" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "transactions: alterar as próprias" on public.transactions;
create policy "transactions: alterar as próprias" on public.transactions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.transactions from anon;
grant select, insert, update on public.transactions to authenticated;
drop trigger if exists transactions_sync on public.transactions;
create trigger transactions_sync before insert or update on public.transactions
  for each row execute function public.finance_sync_row();

-- budgets
create table if not exists public.budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
alter table public.budgets add column if not exists "category_id" text not null;
alter table public.budgets add column if not exists "amount_cents" bigint not null;
alter table public.budgets add column if not exists "created_at" text not null;
alter table public.budgets add column if not exists "updated_at" text not null;
alter table public.budgets add column if not exists "deleted_at" text;
create index if not exists budgets_pull_idx on public.budgets (user_id, server_updated_at, id);
alter table public.budgets enable row level security;
drop policy if exists "budgets: ler as próprias" on public.budgets;
create policy "budgets: ler as próprias" on public.budgets
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "budgets: criar as próprias" on public.budgets;
create policy "budgets: criar as próprias" on public.budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "budgets: alterar as próprias" on public.budgets;
create policy "budgets: alterar as próprias" on public.budgets
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.budgets from anon;
grant select, insert, update on public.budgets to authenticated;
drop trigger if exists budgets_sync on public.budgets;
create trigger budgets_sync before insert or update on public.budgets
  for each row execute function public.finance_sync_row();

-- goals
create table if not exists public.goals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
alter table public.goals add column if not exists "name" text not null;
alter table public.goals add column if not exists "target_cents" bigint not null;
alter table public.goals add column if not exists "target_date" text;
alter table public.goals add column if not exists "color" text not null;
alter table public.goals add column if not exists "icon" text not null;
alter table public.goals add column if not exists "account_id" text;
alter table public.goals add column if not exists "archived_at" text;
alter table public.goals add column if not exists "created_at" text not null;
alter table public.goals add column if not exists "updated_at" text not null;
alter table public.goals add column if not exists "deleted_at" text;
create index if not exists goals_pull_idx on public.goals (user_id, server_updated_at, id);
alter table public.goals enable row level security;
drop policy if exists "goals: ler as próprias" on public.goals;
create policy "goals: ler as próprias" on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "goals: criar as próprias" on public.goals;
create policy "goals: criar as próprias" on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "goals: alterar as próprias" on public.goals;
create policy "goals: alterar as próprias" on public.goals
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.goals from anon;
grant select, insert, update on public.goals to authenticated;
drop trigger if exists goals_sync on public.goals;
create trigger goals_sync before insert or update on public.goals
  for each row execute function public.finance_sync_row();

-- goal_entries
create table if not exists public.goal_entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
alter table public.goal_entries add column if not exists "goal_id" text not null;
alter table public.goal_entries add column if not exists "amount_cents" bigint not null;
alter table public.goal_entries add column if not exists "occurred_on" text not null;
alter table public.goal_entries add column if not exists "note" text;
alter table public.goal_entries add column if not exists "created_at" text not null;
alter table public.goal_entries add column if not exists "updated_at" text not null;
alter table public.goal_entries add column if not exists "deleted_at" text;
create index if not exists goal_entries_pull_idx on public.goal_entries (user_id, server_updated_at, id);
alter table public.goal_entries enable row level security;
drop policy if exists "goal_entries: ler as próprias" on public.goal_entries;
create policy "goal_entries: ler as próprias" on public.goal_entries
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "goal_entries: criar as próprias" on public.goal_entries;
create policy "goal_entries: criar as próprias" on public.goal_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "goal_entries: alterar as próprias" on public.goal_entries;
create policy "goal_entries: alterar as próprias" on public.goal_entries
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.goal_entries from anon;
grant select, insert, update on public.goal_entries to authenticated;
drop trigger if exists goal_entries_sync on public.goal_entries;
create trigger goal_entries_sync before insert or update on public.goal_entries
  for each row execute function public.finance_sync_row();
