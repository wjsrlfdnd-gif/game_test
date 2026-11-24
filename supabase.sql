-- ============================================================================
-- Random Character Defense — Supabase PostgreSQL Schema + RLS + Atomic RPC
-- Supabase SQL Editor에 전체 내용을 붙여넣고 [Run]을 한 번만 실행하세요.
-- ============================================================================

-- 1. 운영자 권한 테이블
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text default '',
  role text default 'admin',
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

drop policy if exists "admins_select_self" on public.admins;
create policy "admins_select_self"
  on public.admins for select
  to authenticated
  using (auth.uid() = user_id);

-- 2. 플레이어 클라우드 세이브 테이블 (본인 또는 운영자만 읽기/쓰기 가능)
create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text default '',
  is_anonymous boolean not null default true,
  save_json jsonb not null,
  account_gold bigint not null default 0,
  account_gems bigint not null default 0,
  account_shards bigint not null default 0,
  updated_at_ms bigint not null default 0,
  admin_edited_at bigint not null default 0,
  app_version text default '',
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;

drop policy if exists "saves_select_owner_or_admin" on public.saves;
create policy "saves_select_owner_or_admin"
  on public.saves for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "saves_insert_owner_or_admin" on public.saves;
create policy "saves_insert_owner_or_admin"
  on public.saves for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "saves_update_owner_or_admin" on public.saves;
create policy "saves_update_owner_or_admin"
  on public.saves for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- 3. 실시간 공지 · 이벤트 배율 테이블
create table if not exists public.live_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.live_config enable row level security;

drop policy if exists "live_config_read_all" on public.live_config;
create policy "live_config_read_all"
  on public.live_config for select
  to anon, authenticated
  using (true);

drop policy if exists "live_config_admin_write" on public.live_config;
create policy "live_config_admin_write"
  on public.live_config for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. 이벤트 쿠폰 및 1계정 1회 수령 기록 (운영자만 전체 조회, 일반 유저는 RPC로만 단건 수령)
create table if not exists public.coupons (
  code text primary key,
  gold bigint not null default 0,
  gems bigint not null default 0,
  shards bigint not null default 0,
  gold_potion integer not null default 0,
  shock_scroll integer not null default 0,
  boss_bane integer not null default 0,
  item_id text default '',
  item_lv integer not null default 0,
  item_ex integer not null default 0,
  expires_at text default '',
  max_uses integer not null default 0,
  used_count integer not null default 0,
  enabled boolean not null default true,
  created_at_ms bigint not null default 0,
  created_by uuid
);
alter table public.coupons enable row level security;

drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all"
  on public.coupons for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.coupon_claims (
  code text not null references public.coupons(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (code, user_id)
);
alter table public.coupon_claims enable row level security;

drop policy if exists "coupon_claims_select_owner_or_admin" on public.coupon_claims;
create policy "coupon_claims_select_owner_or_admin"
  on public.coupon_claims for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 5. 원자적 쿠폰 수령 RPC (행 잠금 FOR UPDATE + 1계정 1회 + 선착순 제한 검증)
create or replace function public.redeem_coupon(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_coupon public.coupons%rowtype;
  v_today text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD');
begin
  if v_uid is null then
    return jsonb_build_object('status', 'UNAUTHENTICATED');
  end if;
  if v_code = '' then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;

  select * into v_coupon
  from public.coupons
  where code = v_code
  for update;

  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;

  if exists (select 1 from public.coupon_claims where code = v_code and user_id = v_uid) then
    return jsonb_build_object('status', 'ALREADY_CLAIMED');
  end if;

  if v_coupon.enabled is distinct from true then
    return jsonb_build_object('status', 'DISABLED');
  end if;

  if coalesce(v_coupon.expires_at, '') <> '' and v_today > v_coupon.expires_at then
    return jsonb_build_object('status', 'EXPIRED', 'exp', v_coupon.expires_at);
  end if;

  if coalesce(v_coupon.max_uses, 0) > 0 and coalesce(v_coupon.used_count, 0) >= v_coupon.max_uses then
    return jsonb_build_object('status', 'EXHAUSTED', 'maxUses', v_coupon.max_uses);
  end if;

  insert into public.coupon_claims (code, user_id) values (v_code, v_uid);
  update public.coupons set used_count = coalesce(used_count, 0) + 1 where code = v_code;

  return jsonb_build_object(
    'status', 'OK',
    'coupon', jsonb_build_object(
      'code', v_coupon.code,
      'gold', v_coupon.gold,
      'gems', v_coupon.gems,
      'shards', v_coupon.shards,
      'goldPotion', v_coupon.gold_potion,
      'shockScroll', v_coupon.shock_scroll,
      'bossBane', v_coupon.boss_bane,
      'itemId', v_coupon.item_id,
      'itemLv', v_coupon.item_lv,
      'itemEx', v_coupon.item_ex
    )
  );
end;
$$;

grant execute on function public.redeem_coupon(text) to authenticated;

-- 6. Realtime 활성화 (live_config, saves 실시간 동기화)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_config'
  ) then
    alter publication supabase_realtime add table public.live_config;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'saves'
  ) then
    alter publication supabase_realtime add table public.saves;
  end if;
exception when others then
  null;
end $$;
