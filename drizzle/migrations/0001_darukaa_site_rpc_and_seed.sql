-- Geometry-aware write RPCs (GeoJSON in, PostGIS geometry stored) + demo seeding.

create or replace function public.create_site(
  p_project_id uuid,
  p_name text,
  p_description text,
  p_status public.site_status,
  p_geojson jsonb
) returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  g extensions.geometry;
  new_id uuid;
begin
  if p_geojson is null then
    raise exception 'geometry is required';
  end if;
  begin
    g := extensions.st_setsrid(extensions.st_geomfromgeojson(p_geojson::text), 4326);
  exception when others then
    raise exception 'invalid geometry payload';
  end;
  if extensions.geometrytype(g) <> 'POLYGON' then
    raise exception 'geometry must be a single polygon';
  end if;
  if not extensions.st_isvalid(g) then
    g := extensions.st_makevalid(g);
  end if;
  insert into public.sites (project_id, name, description, status, geom)
  values (p_project_id, p_name, nullif(p_description, ''), coalesce(p_status, 'active'), g)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.update_site(
  p_site_id uuid,
  p_name text default null,
  p_description text default null,
  p_status public.site_status default null,
  p_geojson jsonb default null
) returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  g extensions.geometry;
begin
  if p_geojson is not null then
    begin
      g := extensions.st_setsrid(extensions.st_geomfromgeojson(p_geojson::text), 4326);
    exception when others then
      raise exception 'invalid geometry payload';
    end;
    if extensions.geometrytype(g) <> 'POLYGON' then
      raise exception 'geometry must be a single polygon';
    end if;
    if not extensions.st_isvalid(g) then
      g := extensions.st_makevalid(g);
    end if;
  end if;

  update public.sites s
     set name = coalesce(nullif(p_name, ''), s.name),
         description = coalesce(p_description, s.description),
         status = coalesce(p_status, s.status),
         geom = coalesce(g, s.geom)
   where s.id = p_site_id;

  if not found then
    raise exception 'site not found';
  end if;
  return p_site_id;
end;
$$;

grant execute on function public.create_site(uuid, text, text, public.site_status, jsonb) to authenticated;
grant execute on function public.update_site(uuid, text, text, public.site_status, jsonb) to authenticated;

-- irregular but plausible demo polygon around a real coordinate
create or replace function public.demo_polygon(
  lng double precision, lat double precision, radius_km double precision, seed double precision
) returns extensions.geometry
language plpgsql immutable
set search_path = public, extensions
as $$
declare
  pts extensions.geometry[] := '{}';
  i integer;
  jitter double precision;
  dx double precision;
  dy double precision;
begin
  for i in 0..7 loop
    jitter := 0.72 + 0.36 * abs(sin(seed + i * 1.37));
    dx := (radius_km * jitter / (111.32 * cos(radians(lat)))) * cos(2 * pi() * i / 8.0);
    dy := (radius_km * jitter / 110.574) * sin(2 * pi() * i / 8.0);
    pts := pts || extensions.st_makepoint(lng + dx, lat + dy);
  end loop;
  pts := pts || pts[1];
  return extensions.st_setsrid(extensions.st_makepolygon(extensions.st_makeline(pts)), 4326);
end;
$$;
grant execute on function public.demo_polygon(double precision, double precision, double precision, double precision) to authenticated;

-- Demonstration dataset. Geographically plausible regions, synthetic metrics.
create or replace function public.seed_demo_data()
returns integer
language plpgsql
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  existing integer;
  proj record;
  site_rec record;
  pid uuid;
  sid uuid;
  m integer;
  base_carbon numeric;
  base_bio numeric;
  base_forest numeric;
  base_species integer;
  created integer := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select count(*) into existing from public.projects where created_by = uid;
  if existing > 0 then
    return 0;
  end if;

  for proj in
    select * from (values
      ('Western Ghats Restoration Corridor', 'Rainforest restoration and above-ground carbon accrual across fragmented shade-coffee landscapes.', 'carbon_and_biodiversity', 'active', 'India', 'Karnataka'),
      ('Sundarbans Mangrove Blue Carbon', 'Tidal mangrove protection and blue-carbon monitoring across delta creek systems.', 'carbon', 'active', 'India', 'West Bengal'),
      ('Terai Grassland Biodiversity Watch', 'Grassland and riparian habitat monitoring for indicator megafauna and bird assemblages.', 'biodiversity', 'active', 'Nepal', 'Lumbini'),
      ('Cerrado Savanna Carbon Reserve', 'Avoided-conversion carbon reserve across savanna woodland mosaics.', 'carbon', 'planning', 'Brazil', 'Goias'),
      ('Borneo Peatland Rewetting', 'Peat hydrology restoration with subsidence and emissions monitoring.', 'carbon_and_biodiversity', 'completed', 'Indonesia', 'Central Kalimantan')
    ) as t(name, description, project_type, status, country, region)
  loop
    insert into public.projects (name, description, project_type, status, country, region, created_by)
    values (proj.name, proj.description, proj.project_type::public.project_type, proj.status::public.project_status,
            proj.country, proj.region, uid)
    returning id into pid;
    created := created + 1;

    for site_rec in
      select * from (values
        ('Western Ghats Restoration Corridor', 'Agumbe Ridge Block', 75.09, 13.50, 3.4, 'active'),
        ('Western Ghats Restoration Corridor', 'Kudremukh Shola Patch', 75.25, 13.22, 2.6, 'monitoring'),
        ('Western Ghats Restoration Corridor', 'Sringeri Riparian Strip', 75.25, 13.42, 1.9, 'active'),
        ('Sundarbans Mangrove Blue Carbon', 'Gosaba Creek Delta', 88.80, 22.16, 4.2, 'active'),
        ('Sundarbans Mangrove Blue Carbon', 'Pakhiralay Tidal Flat', 88.81, 22.11, 3.1, 'monitoring'),
        ('Terai Grassland Biodiversity Watch', 'Bardia Phanta North', 81.34, 28.38, 5.0, 'active'),
        ('Terai Grassland Biodiversity Watch', 'Karnali Floodplain', 81.16, 28.62, 3.7, 'planning'),
        ('Cerrado Savanna Carbon Reserve', 'Chapada Plateau Unit', -47.62, -15.62, 6.4, 'planning'),
        ('Borneo Peatland Rewetting', 'Sebangau Canal Block A', 113.90, -2.30, 5.6, 'completed'),
        ('Borneo Peatland Rewetting', 'Kahayan Peat Dome', 114.12, -2.55, 4.8, 'monitoring')
      ) as s(project_name, name, lng, lat, radius_km, status)
      where s.project_name = proj.name
    loop
      insert into public.sites (project_id, name, description, status, geom)
      values (pid, site_rec.name,
              'Demonstration monitoring unit delineated from field boundaries.',
              site_rec.status::public.site_status,
              public.demo_polygon(site_rec.lng, site_rec.lat, site_rec.radius_km, site_rec.lat + site_rec.lng))
      returning id into sid;

      base_carbon := 180 + 90 * abs(sin(site_rec.lng));
      base_bio := 52 + 28 * abs(cos(site_rec.lat));
      base_forest := 45 + 40 * abs(sin(site_rec.lat * 0.7));
      base_species := 60 + (abs(site_rec.lng)::integer % 90);

      for m in 0..23 loop
        insert into public.site_metrics (
          site_id, recorded_at, carbon_sequestered, biodiversity_index,
          forest_cover_percentage, species_count, water_quality_index, project_health_score
        ) values (
          sid,
          date_trunc('day', now()) - ((23 - m) * interval '30 days'),
          round((base_carbon * (0.62 + 0.021 * m) + 12 * sin(m * 0.9 + site_rec.lat))::numeric, 2),
          round(least(98, greatest(5, base_bio * (0.86 + 0.008 * m) + 3 * sin(m * 0.7)))::numeric, 2),
          round(least(99, greatest(4, base_forest * (0.9 + 0.006 * m) + 2 * cos(m * 0.5)))::numeric, 2),
          greatest(1, base_species + (m * 2) + (abs(sin(m * 1.3)) * 9)::integer),
          round(least(99, greatest(20, 64 + 14 * sin(m * 0.45 + site_rec.lng * 0.1) + 0.35 * m))::numeric, 2),
          round(least(99, greatest(20, 58 + 0.9 * m + 6 * cos(m * 0.6)))::numeric, 2)
        );
      end loop;
    end loop;
  end loop;

  return created;
end;
$$;
grant execute on function public.seed_demo_data() to authenticated;