create table launch_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'app_page',
  created_at timestamptz not null default now()
);
