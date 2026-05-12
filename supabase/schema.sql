-- ============================================================
-- Follow · Schema v1.0
-- Corre esto en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Habilitar UUID
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────
-- 1. PROFESSIONALS — usuarios que pagan Follow
-- ──────────────────────────────────────────────────────────
create table professionals (
  id                     uuid primary key default uuid_generate_v4(),
  user_id                uuid references auth.users(id) on delete cascade,
  name                   text not null,
  business_name          text,
  email                  text not null,
  whatsapp               text,
  industry               text,                        -- medico, coach, abogado, estetica, etc.
  plan                   text default 'basico',       -- basico | pro | profesional
  plan_status            text default 'trial',        -- trial | active | cancelled | past_due
  trial_ends_at          timestamptz default (now() + interval '14 days'),
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz default now()
);

-- Solo el profesional puede ver/editar su propio perfil
alter table professionals enable row level security;
create policy "profesional ve su perfil"
  on professionals for all
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 2. CLIENTS — clientes/pacientes de cada profesional
-- ──────────────────────────────────────────────────────────
create table clients (
  id              uuid primary key default uuid_generate_v4(),
  professional_id uuid references professionals(id) on delete cascade,
  name            text not null,
  phone           text,                      -- formato: +521XXXXXXXXXX
  email           text,
  notes           text,
  tags            text[],                    -- ["vip", "frecuente", etc.]
  active          boolean default true,
  created_at      timestamptz default now()
);

alter table clients enable row level security;
create policy "profesional ve sus clientes"
  on clients for all
  using (
    professional_id in (
      select id from professionals where user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────
-- 3. APPOINTMENTS — citas programadas
-- ──────────────────────────────────────────────────────────
create table appointments (
  id              uuid primary key default uuid_generate_v4(),
  professional_id uuid references professionals(id) on delete cascade,
  client_id       uuid references clients(id) on delete cascade,
  scheduled_at    timestamptz not null,       -- fecha y hora de la cita
  duration_min    int default 60,             -- duración en minutos
  service         text,                       -- "Consulta", "Corte", "Sesión", etc.
  status          text default 'scheduled',
  -- scheduled | confirmed | no_show | rescheduled | completed | cancelled
  notes           text,
  source          text default 'manual',      -- manual | excel | calendar
  created_at      timestamptz default now()
);

alter table appointments enable row level security;
create policy "profesional ve sus citas"
  on appointments for all
  using (
    professional_id in (
      select id from professionals where user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────
-- 4. MESSAGES — historial de mensajes enviados
-- ──────────────────────────────────────────────────────────
create table messages (
  id              uuid primary key default uuid_generate_v4(),
  appointment_id  uuid references appointments(id) on delete cascade,
  professional_id uuid references professionals(id) on delete cascade,
  client_id       uuid references clients(id) on delete cascade,
  channel         text not null,             -- whatsapp | email
  type            text not null,
  -- confirmation | reminder_24h | reminder_2h | followup | reschedule
  body            text,                      -- texto del mensaje enviado
  status          text default 'pending',    -- pending | sent | delivered | failed
  sent_at         timestamptz,
  created_at      timestamptz default now()
);

alter table messages enable row level security;
create policy "profesional ve sus mensajes"
  on messages for all
  using (
    professional_id in (
      select id from professionals where user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────
-- 5. TEMPLATES — plantillas de mensajes por industria
-- ──────────────────────────────────────────────────────────
create table templates (
  id          uuid primary key default uuid_generate_v4(),
  industry    text,                          -- null = global, o 'medico', 'coach', etc.
  type        text not null,                 -- confirmation | reminder_24h | reminder_2h | etc.
  channel     text not null,                 -- whatsapp | email
  subject     text,                          -- solo para email
  body        text not null,
  -- Variables: {{nombre}}, {{fecha}}, {{hora}}, {{negocio}}, {{servicio}}
  is_default  boolean default false,
  created_at  timestamptz default now()
);

-- Templates son públicos (solo lectura para usuarios autenticados)
alter table templates enable row level security;
create policy "usuarios ven templates"
  on templates for select
  using (auth.role() = 'authenticated');

-- ──────────────────────────────────────────────────────────
-- 6. PLANTILLAS DEFAULT (MVP)
-- ──────────────────────────────────────────────────────────
insert into templates (industry, type, channel, body, is_default) values

-- WhatsApp confirmation
(null, 'confirmation', 'whatsapp',
'Hola {{nombre}} 👋 Te confirmo tu cita con *{{negocio}}* el *{{fecha}}* a las *{{hora}}*. ¿Confirmas tu asistencia? Responde *SÍ* o *NO*.',
true),

-- WhatsApp reminder 24h
(null, 'reminder_24h', 'whatsapp',
'Hola {{nombre}}, te recuerdo que mañana tienes cita con *{{negocio}}* a las *{{hora}}*. Si necesitas cambiarla responde *REAGENDAR*.',
true),

-- WhatsApp reminder 2h
(null, 'reminder_2h', 'whatsapp',
'{{nombre}}, tu cita con *{{negocio}}* es en 2 horas ({{hora}}). ¡Te esperamos! 📍',
true),

-- WhatsApp followup
(null, 'followup', 'whatsapp',
'Hola {{nombre}}, gracias por visitarnos. ¿Cómo te fue? Si necesitas otra cita responde y con gusto te agendamos 😊',
true),

-- WhatsApp reschedule
(null, 'reschedule', 'whatsapp',
'Hola {{nombre}}, notamos que no pudiste asistir. ¿Te gustaría reagendar tu cita con {{negocio}}? Responde con tu disponibilidad y te ayudamos.',
true),

-- Email confirmation
(null, 'confirmation', 'email',
'Hola {{nombre}},\n\nTe confirmamos tu cita con {{negocio}} para el {{fecha}} a las {{hora}}.\n\nSi necesitas cambiarla o cancelarla, responde a este correo.\n\n¡Hasta pronto!',
true);

-- ──────────────────────────────────────────────────────────
-- 6b. BOOKING_SESSIONS — estado conversacional de agendamiento por WhatsApp
-- Cada registro representa un cliente nuevo en medio del flujo de reserva.
-- Pasos: name → service → date → time → (crea client+appointment y borra sesión)
-- ──────────────────────────────────────────────────────────
create table booking_sessions (
  id              uuid primary key default uuid_generate_v4(),
  phone           text not null,                         -- número del cliente (+521XXXXXXXXXX)
  professional_id uuid references professionals(id) on delete cascade,
  step            text not null default 'name',          -- name | service | date | time
  data            jsonb default '{}',                    -- datos acumulados en el flujo
  expires_at      timestamptz default (now() + interval '30 minutes'),
  created_at      timestamptz default now()
);

-- Solo service_role accede a esta tabla (desde Edge Functions)
alter table booking_sessions enable row level security;

create index idx_booking_sessions_phone on booking_sessions(phone);
create index idx_booking_sessions_expires on booking_sessions(expires_at);

-- ──────────────────────────────────────────────────────────
-- 7. ÍNDICES para performance
-- ──────────────────────────────────────────────────────────
create index idx_appointments_professional on appointments(professional_id);
create index idx_appointments_scheduled_at on appointments(scheduled_at);
create index idx_appointments_status on appointments(status);
create index idx_clients_professional on clients(professional_id);
create index idx_messages_appointment on messages(appointment_id);
create index idx_messages_status on messages(status);

-- ──────────────────────────────────────────────────────────
-- 8. TRIGGER — crea fila en professionals cuando se registra un usuario
-- Sin esto, el dashboard queda en blanco para usuarios nuevos.
-- ──────────────────────────────────────────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.professionals (user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ──────────────────────────────────────────────────────────
-- 9. COLUMNAS STRIPE (si ya corriste el schema antes, ejecuta solo esto)
-- ──────────────────────────────────────────────────────────
-- alter table professionals add column if not exists stripe_customer_id text;
-- alter table professionals add column if not exists stripe_subscription_id text;

-- ──────────────────────────────────────────────────────────
-- Listo! Tablas creadas:
-- professionals, clients, appointments, messages, templates, booking_sessions
-- ──────────────────────────────────────────────────────────
