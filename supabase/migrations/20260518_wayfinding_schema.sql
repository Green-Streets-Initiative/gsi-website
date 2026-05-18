-- Wayfinding event template: reusable mobile-first map pages for street festivals
-- First instance: Carnaval (East Somerville Main Streets, Jun 7 2026)

create table wayfinding_events (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  eyebrow         text,
  organizer_name  text,
  organizer_logo_url text,
  date_primary    date not null,
  date_rain       date,
  time_start      time,
  time_end        time,
  accent_color    text not null default '#D81B60',
  corridor_geojson jsonb,
  center_lat      float8 not null,
  center_lng      float8 not null,
  default_zoom    smallint default 15,
  locales         text[] default '{en}',
  attribution     text default 'Wayfinding by Green Streets Initiative',
  is_rain_date    boolean default false,
  is_cancelled    boolean default false,
  is_published    boolean default false,
  admin_token     text,
  created_at      timestamptz default now()
);

create table wayfinding_businesses (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid references wayfinding_events(id) on delete cascade,
  name            text not null,
  category        text not null,
  description     text,
  lat             float8 not null,
  lng             float8 not null,
  address         text,
  website_url     text,
  google_place_id text,
  show_on_map     boolean default true,
  pin_color       text
);

create index idx_wayfinding_businesses_event on wayfinding_businesses(event_id);

create table wayfinding_translations (
  event_id        uuid references wayfinding_events(id) on delete cascade,
  locale          text not null,
  key             text not null,
  value           text not null,
  primary key (event_id, locale, key)
);

-- Enable RLS
alter table wayfinding_events enable row level security;
alter table wayfinding_businesses enable row level security;
alter table wayfinding_translations enable row level security;

-- Public read for published events
create policy "Public can read published events"
  on wayfinding_events for select
  using (is_published = true);

create policy "Public can read event businesses"
  on wayfinding_businesses for select
  using (exists (
    select 1 from wayfinding_events
    where wayfinding_events.id = wayfinding_businesses.event_id
    and wayfinding_events.is_published = true
  ));

create policy "Public can read event translations"
  on wayfinding_translations for select
  using (exists (
    select 1 from wayfinding_events
    where wayfinding_events.id = wayfinding_translations.event_id
    and wayfinding_events.is_published = true
  ));
