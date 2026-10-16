create type public.app_role as enum ('super_admin','admin','supervisor','agent');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('super_admin','admin','supervisor'))
$$;
create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('super_admin','admin'))
$$;

create policy "own roles or staff read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "admins manage roles" on public.user_roles for insert to authenticated
  with check (public.is_admin(auth.uid()) and (role <> 'super_admin' or public.has_role(auth.uid(),'super_admin')));
create policy "admins delete roles" on public.user_roles for delete to authenticated
  using (public.is_admin(auth.uid()));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "profile update own" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.ensure_profile(_full_name text default null, _phone text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text;
begin
  if uid is null then return; end if;
  select email into em from auth.users where id = uid;
  insert into public.profiles(id, full_name, email, phone) values (uid, coalesce(_full_name, split_part(em,'@',1)), em, _phone)
  on conflict (id) do update set full_name = coalesce(_full_name, profiles.full_name), phone = coalesce(_phone, profiles.phone);
  insert into public.user_roles(user_id, role) values (uid, 'agent') on conflict do nothing;
  if not exists (select 1 from public.user_roles where role = 'super_admin') then
    insert into public.user_roles(user_id, role) values (uid, 'super_admin') on conflict do nothing;
  end if;
end $$;
grant execute on function public.ensure_profile(text, text) to authenticated;

create table public.provinces (id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province_id uuid not null references public.provinces(id),
  commune text,
  lat double precision not null,
  lng double precision not null,
  market_days text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(name, province_id)
);
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique, sort int default 0);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references public.categories(id),
  default_unit text not null default 'kg',
  active boolean not null default true
);
create unique index products_name_norm on public.products (lower(trim(name)));

grant select on public.provinces, public.markets, public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.provinces, public.markets, public.categories, public.products to authenticated;
grant all on public.provinces, public.markets, public.categories, public.products to service_role;
alter table public.provinces enable row level security;
alter table public.markets enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
create policy "public read" on public.provinces for select using (true);
create policy "public read" on public.markets for select using (true);
create policy "public read" on public.categories for select using (true);
create policy "public read" on public.products for select using (true);
create policy "admin write" on public.provinces for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admin write" on public.markets for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admin write" on public.categories for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admin write" on public.products for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.agent_markets (
  agent_id uuid not null references auth.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  primary key (agent_id, market_id)
);
grant select, insert, delete on public.agent_markets to authenticated;
grant all on public.agent_markets to service_role;
alter table public.agent_markets enable row level security;
create policy "read own or staff" on public.agent_markets for select to authenticated using (agent_id = auth.uid() or public.is_staff(auth.uid()));
create policy "staff assign" on public.agent_markets for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "staff unassign" on public.agent_markets for delete to authenticated using (public.is_staff(auth.uid()));

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid unique,
  market_id uuid not null references public.markets(id),
  product_id uuid not null references public.products(id),
  agent_id uuid references auth.users(id) on delete set null,
  variety text,
  unit text not null default 'kg',
  quantity numeric not null default 1 check (quantity > 0),
  price numeric not null check (price > 0),
  availability text not null default 'disponible',
  quality text,
  origin text,
  source text,
  comment text,
  photo_url text,
  lat double precision,
  lng double precision,
  gps_accuracy double precision,
  distance_m double precision,
  flags text[] not null default '{}',
  status text not null default 'SYNCHRONISEE' check (status in ('SYNCHRONISEE','VALIDEE','REJETEE')),
  reject_reason text,
  review_comment text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index obs_mp on public.observations (market_id, product_id, observed_at desc);
create index obs_status on public.observations (status);
grant select on public.observations to anon;
grant select, insert, update on public.observations to authenticated;
grant all on public.observations to service_role;
alter table public.observations enable row level security;
create policy "public validated" on public.observations for select using (status = 'VALIDEE');
create policy "agent own read" on public.observations for select to authenticated using (agent_id = auth.uid() or public.is_staff(auth.uid()));
create policy "agent insert" on public.observations for insert to authenticated with check (agent_id = auth.uid() and status = 'SYNCHRONISEE');
create policy "agent fix rejected" on public.observations for update to authenticated using (agent_id = auth.uid() and status = 'REJETEE') with check (agent_id = auth.uid() and status = 'SYNCHRONISEE');
create policy "staff review" on public.observations for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create or replace function public.latest_prices()
returns table(market_id uuid, product_id uuid, unit_price numeric, unit text, availability text, observed_at timestamptz, prev_price numeric)
language sql stable security definer set search_path = public as $$
  with v as (select * from observations where status = 'VALIDEE'),
  l as (select distinct on (market_id, product_id) market_id, product_id, round(price/quantity) unit_price, unit, availability, observed_at from v order by market_id, product_id, observed_at desc)
  select l.*, (select round(v.price/v.quantity) from v where v.market_id = l.market_id and v.product_id = l.product_id and v.observed_at <= l.observed_at - interval '25 days' order by v.observed_at desc limit 1)
  from l
$$;
create or replace function public.price_series(_product uuid, _since timestamptz)
returns table(market_id uuid, day date, price numeric)
language sql stable security definer set search_path = public as $$
  select market_id, observed_at::date, round(avg(price/quantity)) from observations
  where status = 'VALIDEE' and product_id = _product and observed_at >= _since
  group by 1,2 order by 2
$$;
create or replace function public.median_price(_market uuid, _product uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select percentile_cont(0.5) within group (order by price/quantity) from (
    select price, quantity from observations where status='VALIDEE' and product_id=_product and market_id=_market order by observed_at desc limit 10) s
$$;
grant execute on function public.latest_prices(), public.price_series(uuid, timestamptz), public.median_price(uuid, uuid) to anon, authenticated;

create policy "photos read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff(auth.uid())));
create policy "photos agent upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.provinces(name) values ('Bujumbura'),('Gitega'),('Butanyerera'),('Buhumuza'),('Burunga');

insert into public.markets(name, province_id, commune, lat, lng, market_days)
select m.name, p.id, m.commune, m.lat, m.lng, m.days from (values
 ('Marché Central de Bujumbura','Bujumbura','Mukaza',-3.3780,29.3640,'Tous les jours'),
 ('Marché de Cotebu','Bujumbura','Ntahangwa',-3.3560,29.3700,'Tous les jours'),
 ('Marché de Ruvumera','Bujumbura','Ntahangwa',-3.3620,29.3590,'Tous les jours'),
 ('Marché de Kinama','Bujumbura','Ntahangwa',-3.3180,29.3830,'Tous les jours'),
 ('Marché de Gitega','Gitega','Gitega',-3.4270,29.9250,'Lundi, Jeudi'),
 ('Marché de Muramvya','Gitega','Muramvya',-3.2660,29.6080,'Mardi, Vendredi'),
 ('Marché de Ngozi','Butanyerera','Ngozi',-2.9080,29.8280,'Mardi, Samedi'),
 ('Marché de Kayanza','Butanyerera','Kayanza',-2.9220,29.6290,'Mercredi, Samedi'),
 ('Marché de Kirundo','Butanyerera','Kirundo',-2.5850,30.0960,'Lundi, Jeudi'),
 ('Marché de Muyinga','Buhumuza','Muyinga',-2.8450,30.3410,'Mardi, Vendredi'),
 ('Marché de Ruyigi','Buhumuza','Ruyigi',-3.4760,30.2490,'Mercredi, Samedi'),
 ('Marché de Cankuzo','Buhumuza','Cankuzo',-3.2190,30.5530,'Jeudi'),
 ('Marché de Rumonge','Burunga','Rumonge',-3.9730,29.4380,'Tous les jours'),
 ('Marché de Makamba','Burunga','Makamba',-4.1350,29.8040,'Mardi, Vendredi'),
 ('Marché de Bururi','Burunga','Bururi',-3.9490,29.6240,'Lundi, Jeudi')
) as m(name, prov, commune, lat, lng, days) join public.provinces p on p.name = m.prov;

insert into public.categories(name, sort) values ('Céréales',1),('Légumineuses',2),('Tubercules',3),('Fruits',4),('Légumes',5),('Huiles',6),('Viande & poisson',7),('Autres',8);

insert into public.products(name, category_id, default_unit)
select x.name, c.id, x.unit from (values
 ('Riz local','Céréales','kg'),('Maïs grain','Céréales','kg'),('Sorgho','Céréales','kg'),
 ('Haricot jaune','Légumineuses','kg'),('Petits pois secs','Légumineuses','kg'),('Arachides','Légumineuses','kg'),
 ('Farine de manioc','Tubercules','kg'),('Pomme de terre','Tubercules','kg'),('Patate douce','Tubercules','kg'),
 ('Banane plantain','Fruits','kg'),('Tomates','Légumes','kg'),('Oignons','Légumes','kg'),
 ('Huile de palme','Huiles','litre'),('Viande de bœuf','Viande & poisson','kg'),('Ndagala séché','Viande & poisson','kg'),('Sucre','Autres','kg')
) as x(name, cat, unit) join public.categories c on c.name = x.cat;

with base(name, price) as (values
 ('Riz local',5200),('Maïs grain',2600),('Sorgho',2500),('Haricot jaune',4400),('Petits pois secs',6200),('Arachides',6800),
 ('Farine de manioc',3000),('Pomme de terre',2100),('Patate douce',1400),('Banane plantain',1900),('Tomates',2800),('Oignons',3800),
 ('Huile de palme',7500),('Viande de bœuf',21000),('Ndagala séché',16000),('Sucre',4800)),
mk as (select m.id, m.name, p.name prov, row_number() over (order by m.name) rn from markets m join provinces p on p.id = m.province_id),
wk as (select generate_series(0, 52) w)
insert into public.observations(market_id, product_id, unit, quantity, price, availability, origin, source, status, observed_at, reviewed_at)
select mk.id, pr.id, pr.default_unit, 1,
  round((b.price
    * (case mk.prov when 'Bujumbura' then 1.10 when 'Burunga' then 1.0 when 'Gitega' then 0.97 when 'Butanyerera' then 0.94 else 0.92 end)
    * (1 + 0.14 * (52 - wk.w)::numeric / 52)
    * (1 + 0.09 * sin((wk.w + mk.rn * 3)::float / 6.5))::numeric
    * (1 + (random() - 0.5) * 0.08)::numeric) / 50) * 50,
  case when random() < 0.08 then 'faible' when random() < 0.02 then 'non disponible' else 'disponible' end,
  case when pr.name in ('Riz local','Sucre','Huile de palme') and random() < 0.4 then 'importé' else 'local' end,
  'Commerçant', 'VALIDEE',
  now() - (wk.w * interval '7 days') - (mk.rn * interval '3 hours'),
  now() - (wk.w * interval '7 days')
from mk cross join wk cross join base b join products pr on pr.name = b.name;

insert into public.observations(market_id, product_id, unit, quantity, price, availability, origin, source, status, observed_at, flags, comment)
select m.id, p.id, p.default_unit, 1, x.price, 'disponible', 'local', 'Commerçant', 'SYNCHRONISEE', now() - interval '2 hours', x.flags, x.cmt
from (values
 ('Marché de Gitega','Riz local',5600,'{}'::text[],null),
 ('Marché de Ngozi','Haricot jaune',9800,'{PRIX_INHABITUEL}'::text[],'Pénurie signalée'),
 ('Marché de Cotebu','Tomates',3300,'{}'::text[],null),
 ('Marché de Kayanza','Pomme de terre',2300,'{GPS_ELOIGNE}'::text[],null)
) as x(mk, pr, price, flags, cmt)
join markets m on m.name = x.mk join products p on p.name = x.pr;