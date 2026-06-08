create extension if not exists pgcrypto;

create type public.app_role as enum ('user', 'admin');
create type public.account_status as enum ('active', 'disabled');
create type public.generation_status as enum ('reserved', 'pending_upstream', 'succeeded', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'user',
  status public.account_status not null default 'active',
  daily_quota integer not null default 20 check (daily_quota >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  used_count integer not null default 0 check (used_count >= 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table public.generation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_task_id text not null,
  upstream_task_id text,
  prompt text,
  image_size text,
  quality text,
  status public.generation_status not null default 'reserved',
  error_message text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, client_task_id)
);

create index generation_records_user_status_idx on public.generation_records(user_id, status);
create index generation_records_upstream_task_idx on public.generation_records(user_id, upstream_task_id) where upstream_task_id is not null;
create index user_usage_daily_date_idx on public.user_usage_daily(usage_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_usage_daily_set_updated_at
before update on public.user_usage_daily
for each row execute function public.set_updated_at();

create trigger generation_records_set_updated_at
before update on public.generation_records
for each row execute function public.set_updated_at();

create or replace view public.admin_user_overview
with (security_invoker = true)
as
select
  p.id,
  p.email,
  p.role,
  p.status,
  p.daily_quota,
  p.created_at,
  p.updated_at,
  coalesce(today.used_count, 0) as today_count,
  coalesce(today.reserved_count, 0) as reserved_count,
  coalesce(total.total_count, 0) as total_count
from public.profiles p
left join public.user_usage_daily today
  on today.user_id = p.id and today.usage_date = current_date
left join (
  select user_id, count(*)::integer as total_count
  from public.generation_records
  where status = 'succeeded'
  group by user_id
) total on total.user_id = p.id;

alter table public.profiles enable row level security;
alter table public.user_usage_daily enable row level security;
alter table public.generation_records enable row level security;

create policy profiles_read_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy profiles_read_admin
on public.profiles
for select
to authenticated
using (
  exists (
    select 1 from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
      and admin_profile.status = 'active'
  )
);

create policy usage_read_own
on public.user_usage_daily
for select
to authenticated
using (auth.uid() = user_id);

create policy usage_read_admin
on public.user_usage_daily
for select
to authenticated
using (
  exists (
    select 1 from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
      and admin_profile.status = 'active'
  )
);

create policy generation_read_own
on public.generation_records
for select
to authenticated
using (auth.uid() = user_id);

create policy generation_read_admin
on public.generation_records
for select
to authenticated
using (
  exists (
    select 1 from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
      and admin_profile.status = 'active'
  )
);

create or replace function public.reserve_generation_quota(
  p_user_id uuid,
  p_client_task_id text,
  p_prompt text default null,
  p_size text default null,
  p_quality text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_usage public.user_usage_daily%rowtype;
  v_record public.generation_records%rowtype;
  v_remaining integer;
begin
  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing', 'error', '用户资料不存在');
  end if;

  if v_profile.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'account_disabled', 'error', '账号已被禁用');
  end if;

  insert into public.user_usage_daily(user_id, usage_date, used_count, reserved_count)
  values (p_user_id, current_date, 0, 0)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.user_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  select * into v_record
  from public.generation_records
  where user_id = p_user_id and client_task_id = p_client_task_id
  for update;

  if found then
    if v_record.status in ('reserved', 'pending_upstream') then
      v_remaining := greatest(v_profile.daily_quota - v_usage.used_count - v_usage.reserved_count, 0);
      return jsonb_build_object('ok', true, 'remaining', v_remaining, 'reserved', true, 'recordId', v_record.id);
    end if;

    if v_record.status = 'succeeded' then
      v_remaining := greatest(v_profile.daily_quota - v_usage.used_count - v_usage.reserved_count, 0);
      return jsonb_build_object('ok', true, 'remaining', v_remaining, 'alreadyCompleted', true, 'recordId', v_record.id);
    end if;
  end if;

  if v_usage.used_count + v_usage.reserved_count >= v_profile.daily_quota then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota_exceeded',
      'error', '今日额度已用完',
      'remaining', 0
    );
  end if;

  if v_record.id is null then
    insert into public.generation_records(user_id, client_task_id, prompt, image_size, quality, status)
    values (p_user_id, p_client_task_id, p_prompt, p_size, p_quality, 'reserved')
    returning * into v_record;
  else
    update public.generation_records
    set status = 'reserved', prompt = p_prompt, image_size = p_size, quality = p_quality, error_message = null, completed_at = null
    where id = v_record.id
    returning * into v_record;
  end if;

  update public.user_usage_daily
  set reserved_count = reserved_count + 1
  where user_id = p_user_id and usage_date = current_date
  returning * into v_usage;

  v_remaining := greatest(v_profile.daily_quota - v_usage.used_count - v_usage.reserved_count, 0);

  return jsonb_build_object('ok', true, 'remaining', v_remaining, 'recordId', v_record.id);
end;
$$;

create or replace function public.mark_generation_upstream_task(
  p_user_id uuid,
  p_client_task_id text,
  p_upstream_task_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.generation_records%rowtype;
begin
  update public.generation_records
  set upstream_task_id = p_upstream_task_id,
      status = case when status = 'reserved' then 'pending_upstream' else status end
  where user_id = p_user_id
    and client_task_id = p_client_task_id
    and status in ('reserved', 'pending_upstream')
  returning * into v_record;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'record_missing');
  end if;

  return jsonb_build_object('ok', true, 'recordId', v_record.id);
end;
$$;

create or replace function public.complete_generation_quota(
  p_user_id uuid,
  p_client_task_id text,
  p_upstream_task_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.generation_records%rowtype;
  v_usage public.user_usage_daily%rowtype;
begin
  select * into v_record
  from public.generation_records
  where user_id = p_user_id and client_task_id = p_client_task_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'record_missing', 'error', '任务记录不存在');
  end if;

  if v_record.status = 'succeeded' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'recordId', v_record.id);
  end if;

  if v_record.status not in ('reserved', 'pending_upstream') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status', 'error', '任务状态不允许确认');
  end if;

  insert into public.user_usage_daily(user_id, usage_date, used_count, reserved_count)
  values (p_user_id, current_date, 0, 0)
  on conflict (user_id, usage_date) do nothing;

  update public.user_usage_daily
  set reserved_count = greatest(reserved_count - 1, 0),
      used_count = used_count + 1
  where user_id = p_user_id and usage_date = current_date
  returning * into v_usage;

  update public.generation_records
  set status = 'succeeded',
      upstream_task_id = coalesce(p_upstream_task_id, upstream_task_id),
      completed_at = now(),
      error_message = null
  where id = v_record.id
  returning * into v_record;

  return jsonb_build_object(
    'ok', true,
    'recordId', v_record.id,
    'usedCount', v_usage.used_count,
    'reservedCount', v_usage.reserved_count
  );
end;
$$;

create or replace function public.release_generation_quota(
  p_user_id uuid,
  p_client_task_id text,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.generation_records%rowtype;
  v_usage public.user_usage_daily%rowtype;
begin
  select * into v_record
  from public.generation_records
  where user_id = p_user_id and client_task_id = p_client_task_id
  for update;

  if not found then
    return jsonb_build_object('ok', true, 'recordMissing', true);
  end if;

  if v_record.status = 'succeeded' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'recordId', v_record.id);
  end if;

  if v_record.status in ('reserved', 'pending_upstream') then
    update public.user_usage_daily
    set reserved_count = greatest(reserved_count - 1, 0)
    where user_id = p_user_id and usage_date = current_date
    returning * into v_usage;
  end if;

  update public.generation_records
  set status = 'failed',
      completed_at = now(),
      error_message = p_error_message
  where id = v_record.id
  returning * into v_record;

  return jsonb_build_object('ok', true, 'recordId', v_record.id);
end;
$$;

grant select on public.profiles to authenticated;
grant select on public.user_usage_daily to authenticated;
grant select on public.generation_records to authenticated;
grant execute on function public.reserve_generation_quota(uuid, text, text, text, text) to service_role;
grant execute on function public.mark_generation_upstream_task(uuid, text, text) to service_role;
grant execute on function public.complete_generation_quota(uuid, text, text) to service_role;
grant execute on function public.release_generation_quota(uuid, text, text) to service_role;