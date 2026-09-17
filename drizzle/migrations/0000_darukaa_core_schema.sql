-- Darukaa.Earth core schema
-- Spatial reference: EPSG:4326 (WGS84 lon/lat) for storage; area computed on the
-- spheroid via geography casts so hectare values are metrically correct anywhere.
create extension if not exists postgis with schema extensions;

create type public.app_role as enum ('admin', 'member');
create type public.project_type as enum ('carbon', 'biodiversity', 'carbon_and_biodiversity');
create type public.project_status as enum ('planning', 'active', 'completed', 'archived');
create type public.site_status as enum ('planning', 'active', 'monitoring', 'completed', 'archived');

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- new users get a profile + admin role (single-tenant admin workspace product)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'admin')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  description text,
  project_type public.project_type not null default 'carbon',
  status public.project_status not null default 'planning',
  country text,
  region text,
  total_area_hectares numeric(14,4) not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_created_by_idx on public.projects (created_by);
create index projects_status_idx on public.projects (status);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "projects_select_own" on public.projects for select to authenticated using (created_by = auth.uid());
create policy "projects_insert_own" on public.projects for insert to authenticated with check (created_by = auth.uid());
create policy "projects_update_own" on public.projects for update to authenticated using (created_by = auth.uid());
create policy "projects_delete_own" on public.projects for delete to authenticated using (created_by = auth.uid());
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- sites
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  area_hectares numeric(14,4) not null default 0,
  geom extensions.geometry(Polygon, 4326) not null,
  centroid extensions.geometry(Point, 4326),
  status public.site_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sites_geom_valid check (extensions.st_isvalid(geom))
);
create index sites_geom_gix on public.sites using gist (geom);
create index sites_centroid_gix on public.sites using gist (centroid);
create index sites_project_id_idx on public.sites (project_id);
grant select, insert, update, delete on public.sites to authenticated;
grant all on public.sites to service_role;
alter table public.sites enable row level security;
create policy "sites_select_own" on public.sites for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid()));
create policy "sites_insert_own" on public.sites for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid()));
create policy "sites_update_own" on public.sites for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid()));
create policy "sites_delete_own" on public.sites for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid()));

-- derive centroid + spheroidal area (hectares) from the stored polygon
create or replace function public.sites_derive_spatial()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.geom := extensions.st_setsrid(extensions.st_makevalid(new.geom), 4326);
  new.centroid := extensions.st_centroid(new.geom);
  new.area_hectares := round((extensions.st_area(new.geom::extensions.geography) / 10000.0)::numeric, 4);
  new.updated_at := now();
  return new;
end;
$$;
create trigger sites_derive before insert or update on public.sites
  for each row execute function public.sites_derive_spatial();

-- keep projects.total_area_hectares in sync with its sites
create or replace function public.sync_project_area()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects p
     set total_area_hectares = coalesce((select sum(s.area_hectares) from public.sites s where s.project_id = pid), 0)
   where p.id = pid;
  return null;
end;
$$;
create trigger sites_sync_project_area after insert or update or delete on public.sites
  for each row execute function public.sync_project_area();

-- ---------------------------------------------------------------- metrics
create table public.site_metrics (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  carbon_sequestered numeric(14,3) not null default 0 check (carbon_sequestered >= 0),
  biodiversity_index numeric(5,2) not null default 0 check (biodiversity_index between 0 and 100),
  forest_cover_percentage numeric(5,2) not null default 0 check (forest_cover_percentage between 0 and 100),
  species_count integer not null default 0 check (species_count >= 0),
  water_quality_index numeric(5,2) not null default 0 check (water_quality_index between 0 and 100),
  project_health_score numeric(5,2) not null default 0 check (project_health_score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (site_id, recorded_at)
);
create index site_metrics_site_recorded_idx on public.site_metrics (site_id, recorded_at desc);
grant select, insert, update, delete on public.site_metrics to authenticated;
grant all on public.site_metrics to service_role;
alter table public.site_metrics enable row level security;
create policy "site_metrics_select_own" on public.site_metrics for select to authenticated
  using (exists (select 1 from public.sites s join public.projects p on p.id = s.project_id
                  where s.id = site_id and p.created_by = auth.uid()));
create policy "site_metrics_insert_own" on public.site_metrics for insert to authenticated
  with check (exists (select 1 from public.sites s join public.projects p on p.id = s.project_id
                  where s.id = site_id and p.created_by = auth.uid()));
create policy "site_metrics_delete_own" on public.site_metrics for delete to authenticated
  using (exists (select 1 from public.sites s join public.projects p on p.id = s.project_id
                  where s.id = site_id and p.created_by = auth.uid()));

-- ---------------------------------------------------------------- GeoJSON view
create view public.sites_geo with (security_invoker = true) as
select s.id, s.project_id, s.name, s.description, s.area_hectares, s.status,
       s.created_at, s.updated_at,
       extensions.st_asgeojson(s.geom)::jsonb as geometry,
       extensions.st_x(s.centroid) as centroid_lng,
       extensions.st_y(s.centroid) as centroid_lat,
       p.name as project_name, p.project_type, p.status as project_status,
       p.country, p.region
  from public.sites s
  join public.projects p on p.id = s.project_id;
grant select on public.sites_geo to authenticated;
grant all on public.sites_geo to service_role;