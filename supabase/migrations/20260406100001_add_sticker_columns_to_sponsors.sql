alter table sponsors
  add column sticker_requested boolean not null default false,
  add column printful_order_id text,
  add column printful_order_status text,
  add column sticker_requested_at timestamptz;
