create extension if not exists vector;

create table if not exists memory_items (
  id text primary key,
  content text not null,
  embedding vector(384),
  x double precision,
  y double precision,
  z double precision,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
