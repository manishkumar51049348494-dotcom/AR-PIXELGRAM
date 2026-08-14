-- email -> user_id lookup (auth.users PostgREST se nahi milta), sirf service_role ke liye.
create or replace function public.get_user_id_by_email(_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(_email) limit 1
$$;
revoke all on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;
