alter table sponsor_applications
  add column if not exists sticker_requested boolean not null default false,
  add column if not exists sticker_requested_at timestamptz,
  add column if not exists address_line1 text,
  add column if not exists address_state text,
  add column if not exists address_zip text;
