import { SYNC_TABLES, type SyncTable } from '@/db/sync-tables';

/**
 * Gera o SQL das tabelas na nuvem (Supabase/Postgres) a partir das colunas das tabelas locais.
 * O resultado fica em supabase/schema.sql; um teste garante que o arquivo está em dia.
 *
 * Cada tabela na nuvem tem as mesmas colunas da local, mais:
 *  - user_id: dono do registro (o RLS só deixa cada pessoa ver e gravar as próprias linhas);
 *  - server_updated_at: carimbo do servidor, usado como cursor para baixar o que mudou.
 * A chave é (user_id, id), porque as categorias/conta padrão têm o mesmo ID em todas as contas.
 *
 * O SQL pode ser rodado de novo sem problema: cria só o que falta e acrescenta colunas novas.
 */

export type LocalColumn = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
};

const pgType = (sqliteType: string) => (/INT/i.test(sqliteType) ? 'bigint' : 'text');

function columnSql(c: LocalColumn) {
  const parts = [`"${c.name}"`, pgType(c.type)];
  if (c.dflt_value !== null) parts.push(`default ${c.dflt_value}`);
  if (c.notnull) parts.push('not null');
  return parts.join(' ');
}

function tableSql(table: SyncTable, columns: LocalColumn[]) {
  const t = `public.${table}`;
  const extra = columns
    .filter((c) => c.name !== 'id')
    .map((c) => `alter table ${t} add column if not exists ${columnSql(c)};`)
    .join('\n');
  return `-- ${table}
create table if not exists ${t} (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
${extra}
create index if not exists ${table}_pull_idx on ${t} (user_id, server_updated_at, id);
alter table ${t} enable row level security;
drop policy if exists "${table}: ler as próprias" on ${t};
create policy "${table}: ler as próprias" on ${t}
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "${table}: criar as próprias" on ${t};
create policy "${table}: criar as próprias" on ${t}
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "${table}: alterar as próprias" on ${t};
create policy "${table}: alterar as próprias" on ${t}
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on ${t} from anon;
grant select, insert, update on ${t} to authenticated;
drop trigger if exists ${table}_sync on ${t};
create trigger ${table}_sync before insert or update on ${t}
  for each row execute function public.finance_sync_row();
`;
}

export function buildRemoteSchemaSql(columnsOf: (table: SyncTable) => LocalColumn[]): string {
  const header = `-- Finanças: tabelas da nuvem para a sincronização.
-- GERADO AUTOMATICAMENTE por src/features/sync/remoteSchema.ts (não edite à mão;
-- rode \`npm run supabase:sql\` depois de mudar as tabelas do app).
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
`;
  return [header, ...SYNC_TABLES.map((t) => tableSql(t, columnsOf(t)))].join('\n');
}
