create table if not exists starred_buildings (
  building_name text primary key,
  starred_at timestamptz not null default now()
);
