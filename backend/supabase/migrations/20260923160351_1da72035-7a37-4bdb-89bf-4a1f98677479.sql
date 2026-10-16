alter function public.latest_prices() security invoker;
alter function public.price_series(uuid, timestamptz) security invoker;
alter function public.median_price(uuid, uuid) security invoker;
revoke execute on function public.has_role(uuid, app_role) from anon, public;
revoke execute on function public.is_staff(uuid) from anon, public;
revoke execute on function public.is_admin(uuid) from anon, public;
revoke execute on function public.ensure_profile(text, text) from anon, public;
grant execute on function public.has_role(uuid, app_role), public.is_staff(uuid), public.is_admin(uuid), public.ensure_profile(text, text) to authenticated;