create or replace function public.set_app_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists app_settings_no_client_access on public.app_settings;
create policy app_settings_no_client_access
on public.app_settings
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
