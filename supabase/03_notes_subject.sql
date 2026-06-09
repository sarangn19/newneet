-- Add subject column to notes table (if missing)
alter table public.notes add column if not exists subject text not null default '';
