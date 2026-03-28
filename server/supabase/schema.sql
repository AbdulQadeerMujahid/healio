-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'patient' check (role in ('patient', 'doctor')),
  specialization text,
  experience integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure role constraint is updated on existing tables too
alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check
  check (role in ('patient', 'doctor'));

create trigger users_set_updated_at
before update on users
for each row
execute function set_updated_at();

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references users(id) on delete cascade,
  doctor_id uuid not null references users(id) on delete cascade,
  reason text not null,
  datetime timestamptz not null,
  age integer not null,
  weight numeric not null,
  severity integer check (severity between 1 and 5),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rescheduled', 'declined', 'completed')),
  rescheduled_time timestamptz,
  meeting_link text,
  notes jsonb not null default '[]'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_patient_id on appointments(patient_id);
create index if not exists idx_appointments_doctor_id on appointments(doctor_id);
create index if not exists idx_appointments_datetime on appointments(datetime desc);

create trigger appointments_set_updated_at
before update on appointments
for each row
execute function set_updated_at();

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text,
  report_type text not null default 'other' check (report_type in ('lab', 'xray', 'mri', 'ct', 'prescription', 'discharge', 'other')),
  file_data text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  uploaded_by uuid not null references users(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reports_patient_id on reports(patient_id);
create index if not exists idx_reports_uploaded_by on reports(uploaded_by);

create trigger reports_set_updated_at
before update on reports
for each row
execute function set_updated_at();

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null default 'general' check (type in ('message', 'appointment', 'report', 'general')),
  title text,
  body text,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_read on notifications(read);

create trigger notifications_set_updated_at
before update on notifications
for each row
execute function set_updated_at();

create table if not exists patient_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references users(id) on delete cascade,
  doctor_id uuid not null references users(id) on delete cascade,
  title text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_notes_patient_id on patient_notes(patient_id);
create index if not exists idx_patient_notes_doctor_id on patient_notes(doctor_id);

create trigger patient_notes_set_updated_at
before update on patient_notes
for each row
execute function set_updated_at();
