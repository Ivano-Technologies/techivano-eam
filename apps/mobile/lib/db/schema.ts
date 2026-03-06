/**
 * SQLite schema for offline-first expense tracking.
 * Tables: expenses (local + sync_status), expense_categories cache, sync_queue, ocr_queue.
 */

export const EXPENSES_TABLE = `
create table if not exists expenses (
  id text primary key,
  local_id text unique,
  user_id text not null,
  date text not null,
  amount real not null,
  currency text default 'NGN',
  category_id text,
  vendor text,
  vat_amount real default 0,
  receipt_url text,
  notes text,
  created_at text default (datetime('now')),
  updated_at text default (datetime('now')),
  synced_at text,
  sync_status text default 'pending',
  deleted integer default 0
);
`;

export const EXPENSE_CATEGORIES_TABLE = `
create table if not exists expense_categories (
  id text primary key,
  user_id text,
  name text not null,
  is_custom integer default 1,
  created_at text
);
`;

export const SYNC_QUEUE_TABLE = `
create table if not exists sync_queue (
  id integer primary key autoincrement,
  entity_type text not null,
  entity_id text not null,
  operation text not null,
  payload text,
  created_at text default (datetime('now')),
  last_attempt_at text,
  error text
);
`;

export const OCR_QUEUE_TABLE = `
create table if not exists ocr_queue (
  id integer primary key autoincrement,
  image_path text not null,
  idempotency_key text unique,
  state text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at text,
  last_error text,
  ocr_payload text,
  receipt_id text,
  entry_id text,
  created_at text default (datetime('now')),
  updated_at text default (datetime('now')),
  processed_at text,
  expense_id text
);
`;

export const SYNC_META_TABLE = `
create table if not exists sync_meta (
  key text primary key,
  value text
);
`;

export const WORK_ORDERS_TABLE = `
create table if not exists work_orders (
  id text primary key,
  tenant_id text not null,
  technician_id text not null,
  asset_id text,
  title text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  scheduled_for text,
  due_date text,
  qr_payload text,
  signature text,
  notes text,
  created_at text default (datetime('now')),
  updated_at text default (datetime('now')),
  sync_status text default 'pending'
);
`;

export const WORK_ORDER_PHOTOS_TABLE = `
create table if not exists work_order_photos (
  id text primary key,
  work_order_id text not null,
  local_uri text not null,
  uploaded_url text,
  created_at text default (datetime('now')),
  foreign key(work_order_id) references work_orders(id) on delete cascade
);
`;

export const ALL_SCHEMAS = [
  EXPENSES_TABLE,
  EXPENSE_CATEGORIES_TABLE,
  SYNC_QUEUE_TABLE,
  OCR_QUEUE_TABLE,
  SYNC_META_TABLE,
  WORK_ORDERS_TABLE,
  WORK_ORDER_PHOTOS_TABLE,
];
