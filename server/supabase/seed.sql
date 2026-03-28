-- Supabase seed data for Health Connect
-- Run after schema.sql

create extension if not exists pgcrypto;

-- 1) Seed doctors (one per specialization)
insert into users (name, email, password_hash, role, specialization, experience)
values
  ('Dr. Aisha Khan', 'doctor.general@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'General Medicine', 8),
  ('Dr. Arjun Mehta', 'doctor.cardio@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'Cardiology', 11),
  ('Dr. Sara Iqbal', 'doctor.derma@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'Dermatology', 7),
  ('Dr. Neel Patil', 'doctor.neuro@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'Neurology', 10),
  ('Dr. Kavya Rao', 'doctor.ortho@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'Orthopedics', 9),
  ('Dr. Rohan Singh', 'doctor.pedia@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'Pediatrics', 6),
  ('Dr. Nidhi Sharma', 'doctor.psych@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'Psychiatry', 12),
  ('Dr. Imran Ali', 'doctor.surgery@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'Surgery', 14),
  ('Dr. Priya Deshmukh', 'doctor.gyn@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'Gynecology', 13),
  ('Dr. Omar Farooq', 'doctor.other@healthconnect.local', crypt('Doctor@123', gen_salt('bf')), 'doctor', 'Other', 5)
on conflict (email) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  specialization = excluded.specialization,
  experience = excluded.experience,
  updated_at = now();

-- 2) Seed patients
insert into users (name, email, password_hash, role)
values
  ('Aman Verma', 'patient.aman@healthconnect.local', crypt('Patient@123', gen_salt('bf')), 'patient'),
  ('Fatima Noor', 'patient.fatima@healthconnect.local', crypt('Patient@123', gen_salt('bf')), 'patient'),
  ('Rahul Joshi', 'patient.rahul@healthconnect.local', crypt('Patient@123', gen_salt('bf')), 'patient'),
  ('Sana Sheikh', 'patient.sana@healthconnect.local', crypt('Patient@123', gen_salt('bf')), 'patient'),
  ('Vikram Das', 'patient.vikram@healthconnect.local', crypt('Patient@123', gen_salt('bf')), 'patient')
on conflict (email) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  updated_at = now();

-- 3) Create appointments: every doctor gets multiple patient appointments
insert into appointments
  (patient_id, doctor_id, reason, datetime, age, weight, severity, status, meeting_link, notes, messages)
select
  p.id as patient_id,
  d.id as doctor_id,
  case
    when d.specialization = 'Cardiology' then 'Chest discomfort and palpitations'
    when d.specialization = 'Dermatology' then 'Persistent skin rash'
    when d.specialization = 'Neurology' then 'Frequent headaches and dizziness'
    when d.specialization = 'Orthopedics' then 'Knee pain while walking'
    when d.specialization = 'Pediatrics' then 'Child fever and cough'
    when d.specialization = 'Psychiatry' then 'Sleep issues and anxiety'
    when d.specialization = 'Surgery' then 'Post-op follow-up consultation'
    when d.specialization = 'Gynecology' then 'Routine women health checkup'
    when d.specialization = 'General Medicine' then 'General fatigue and weakness'
    else 'General consultation'
  end as reason,
  now() + ((row_number() over (partition by d.id order by p.id) * 2) || ' hours')::interval as datetime,
  20 + ((abs(mod(('x' || substr(md5(p.email),1,8))::bit(32)::int, 35)))) as age,
  48 + ((abs(mod(('x' || substr(md5(d.email || p.email),1,8))::bit(32)::int, 42)))) as weight,
  1 + (abs(mod(('x' || substr(md5(d.email || p.email || 'sev'),1,8))::bit(32)::int, 5))) as severity,
  case
    when mod(abs(('x' || substr(md5(d.email || p.email || 'status'),1,8))::bit(32)::int), 5) = 0 then 'pending'
    when mod(abs(('x' || substr(md5(d.email || p.email || 'status'),1,8))::bit(32)::int), 5) = 1 then 'accepted'
    when mod(abs(('x' || substr(md5(d.email || p.email || 'status'),1,8))::bit(32)::int), 5) = 2 then 'rescheduled'
    when mod(abs(('x' || substr(md5(d.email || p.email || 'status'),1,8))::bit(32)::int), 5) = 3 then 'completed'
    else 'declined'
  end as status,
  ('jitsi:health-' || replace(d.id::text, '-', '') || '-' || replace(p.id::text, '-', '')) as meeting_link,
  jsonb_build_array(
    jsonb_build_object('author', d.id::text, 'text', 'Initial review done. Please follow recommendations.', 'createdAt', now()::text)
  ) as notes,
  jsonb_build_array(
    jsonb_build_object('author', p.id::text, 'text', 'Hello doctor, sharing my symptoms.', 'createdAt', now()::text),
    jsonb_build_object('author', d.id::text, 'text', 'Received. Please keep hydration and rest.', 'createdAt', (now() + interval '10 minutes')::text)
  ) as messages
from users d
cross join lateral (
  select id, email from users where role = 'patient' order by email limit 3
) p
where d.role = 'doctor'
on conflict do nothing;

-- 4) Seed reports for each patient
insert into reports
  (patient_id, title, description, report_type, file_data, file_name, file_type, file_size, uploaded_by, appointment_id, date)
select
  p.id,
  'Baseline Health Report',
  'Auto-generated seed report for analytics and dashboard testing.',
  'lab',
  'data:text/plain;base64,VGhpcyBpcyBhIHNlZWQgcmVwb3J0IGZpbGUu',
  'baseline-report.txt',
  'text/plain',
  1024,
  p.id,
  (
    select a.id from appointments a
    where a.patient_id = p.id
    order by a.created_at desc
    limit 1
  ),
  now()
from users p
where p.role = 'patient'
on conflict do nothing;

-- 5) Seed notifications
insert into notifications (user_id, type, title, body, data, read)
select
  u.id,
  'appointment',
  'Welcome to Health Connect',
  'Your dashboard is ready with seeded data.',
  '{}'::jsonb,
  false
from users u
where u.role in ('doctor', 'patient')
on conflict do nothing;

-- 6) Seed doctor private notes for patients
insert into patient_notes (patient_id, doctor_id, title, content)
select
  p.id,
  d.id,
  'Initial Assessment',
  'Seed note: monitor vitals, continue medication, and review in follow-up.'
from users d
join lateral (
  select id from users where role = 'patient' order by email limit 2
) p on true
where d.role = 'doctor'
on conflict do nothing;

-- Helpful logins:
-- Doctor: doctor.general@healthconnect.local  | Password: Doctor@123
-- Patient: patient.aman@healthconnect.local   | Password: Patient@123
