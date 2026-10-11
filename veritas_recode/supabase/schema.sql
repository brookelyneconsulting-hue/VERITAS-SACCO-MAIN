-- VERITAS SACCO independent Supabase PostgreSQL schema
-- Generated from the uploaded Base44 entity definitions; Base44 itself is not required.
-- Run this in Supabase SQL Editor. Never put the Postgres password in frontend code.

create extension if not exists pgcrypto;

create or replace function public.set_updated_date() returns trigger
language plpgsql as $$ begin new.updated_date = now(); return new; end; $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'institution_admin' check (role in ('admin','institution_admin','accountant','front_office','member')),
  institution_id text,
  institution_name text,
  member_id text,
  account_status text not null default 'pending' check (account_status in ('pending','approved','rejected')),
  is_platform_admin boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id,email,full_name) values (new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict (id) do update set email=excluded.email; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  "action" text,
  "actor_name" text,
  "actor_id" text,
  "target_type" text default 'institution',
  "target_id" text,
  "target_name" text,
  "description" text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.bank_deposits (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "deposit_date" date,
  "amount" numeric,
  "source_type" text default 'loan_repayment',
  "reference" text,
  "description" text,
  "payment_id" text,
  "payment_type" text,
  "member_name" text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.bank_withdrawals (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "withdrawal_date" date,
  "amount" numeric,
  "fee" numeric default 0,
  "member_id" text,
  "member_name" text,
  "member_number" text,
  "account_id" text,
  "account_type" text,
  "account_number" text,
  "reference" text,
  "description" text,
  "id_verified" boolean default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.chart_of_accounts (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "account_name" text,
  "account_code" text,
  "account_category" text,
  "account_subcategory" text,
  "opening_balance" numeric default 0,
  "opening_balance_type" text default 'debit',
  "is_system" boolean default false,
  "status" text default 'active',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.dividend_declarations (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "period_start" date,
  "period_end" date,
  "net_profit" numeric default 0,
  "amount_to_share" numeric default 0,
  "total_shares" numeric default 0,
  "dividend_per_share" numeric default 0,
  "payment_date" date,
  "members_paid" numeric default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.dividend_payments (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "declaration_id" text,
  "member_id" text,
  "member_name" text,
  "member_number" text,
  "share_balance" numeric default 0,
  "dividend_per_share" numeric default 0,
  "dividend_amount" numeric default 0,
  "payment_date" date,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.institutions (
  id text primary key default gen_random_uuid()::text,
  "name" text,
  "type" text default 'sacco',
  "registration_number" text,
  "email" text,
  "phone" text,
  "physical_address" text,
  "admin_user_id" text,
  "admin_name" text,
  "plan" text default 'starter',
  "status" text default 'pending',
  "admin_reason" text,
  "joined_date" date,
  "subscription_start" date,
  "subscription_expiry" date,
  "subscription_fee" numeric default 0,
  "member_limit" numeric default 100,
  "payment_status" text default 'none',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.institution_settings (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "currency" text default 'USD',
  "rate_normal" numeric default 12,
  "rate_advance" numeric default 18,
  "rate_emergency" numeric default 24,
  "withdrawal_fee" numeric default 0,
  "deposit_mode" text default 'auto',
  "show_bank_balance" boolean default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "entry_number" text,
  "date" date,
  "description" text,
  "account_category" text,
  "account_subcategory" text,
  "account_name" text,
  "debit" numeric default 0,
  "credit" numeric default 0,
  "reference" text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.loans (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "member_id" text,
  "member_name" text,
  "loan_number" text,
  "principal" numeric,
  "interest_rate" numeric,
  "term_months" numeric,
  "balance" numeric default 0,
  "interest_payable" numeric default 0,
  "installment_amount" numeric default 0,
  "payment_due_date" date,
  "status" text default 'pending',
  "disbursement_date" date,
  "loan_source" text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.loan_applications (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "member_id" text,
  "member_name" text,
  "member_number" text,
  "requested_amount" numeric,
  "purpose" text,
  "requested_term_months" numeric,
  "status" text default 'pending',
  "admin_reason" text,
  "application_date" date,
  "approved_loan_id" text,
  "loan_type" text default 'normal',
  "loan_source" text,
  "deduction_start_date" date,
  "interest_rate" numeric,
  "guarantor_id" text,
  "guarantor_name" text,
  "guarantor_id_number" text,
  "guarantor_status" text default 'pending',
  "guarantor_signature" text,
  "application_letter" text,
  "member_signature" text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.loan_payments (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "member_id" text,
  "member_name" text,
  "member_number" text,
  "loan_id" text,
  "loan_number" text,
  "amount" numeric,
  "payment_ref" text,
  "phone_number" text,
  "payment_date" date,
  "status" text default 'pending',
  "admin_reason" text,
  "repayment_id" text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.members (
  id text primary key default gen_random_uuid()::text,
  "full_name" text,
  "member_number" text,
  "email" text,
  "phone" text,
  "status" text default 'active',
  "subscription_status" text default 'none',
  "joined_date" date,
  "institution_id" text,
  "id_number" text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.member_accounts (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "member_id" text,
  "member_name" text,
  "member_number" text,
  "account_type" text,
  "account_number" text,
  "balance" numeric default 0,
  "status" text default 'active',
  "opened_date" date,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.member_messages (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "title" text,
  "body" text,
  "date" date,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.member_payments (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "member_id" text,
  "member_name" text,
  "member_number" text,
  "payment_type" text,
  "amount" numeric,
  "payment_method" text,
  "payment_ref" text,
  "phone_number" text,
  "payment_date" date,
  "status" text default 'pending',
  "admin_reason" text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.repayments (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "loan_id" text,
  "member_id" text,
  "member_name" text,
  "loan_number" text,
  "installment_number" numeric,
  "amount" numeric,
  "interest_amount" numeric default 0,
  "principal_amount" numeric default 0,
  "balance" numeric default 0,
  "due_date" date,
  "status" text default 'pending',
  "payment_date" date,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.shares (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "member_id" text,
  "member_name" text,
  "balance" numeric default 0,
  "contributions_count" numeric default 0,
  "last_contribution_date" date,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.share_schedules (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "member_id" text,
  "member_name" text,
  "monthly_amount" numeric,
  "start_date" date,
  "next_due_date" date,
  "last_applied_date" date,
  "status" text default 'active',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.share_transactions (
  id text primary key default gen_random_uuid()::text,
  "institution_id" text,
  "type" text,
  "from_member_id" text,
  "from_member_name" text,
  "to_member_id" text,
  "to_member_name" text,
  "amount" numeric,
  "date" date,
  "status" text default 'completed',
  "reference" text,
  "admin_reason" text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_bank_deposits_institution_id on public.bank_deposits ("institution_id");
create index if not exists idx_bank_withdrawals_institution_id on public.bank_withdrawals ("institution_id");
create index if not exists idx_bank_withdrawals_member_id on public.bank_withdrawals ("member_id");
create index if not exists idx_chart_of_accounts_institution_id on public.chart_of_accounts ("institution_id");
create index if not exists idx_dividend_declarations_institution_id on public.dividend_declarations ("institution_id");
create index if not exists idx_dividend_declarations_payment_date on public.dividend_declarations ("payment_date");
create index if not exists idx_dividend_payments_institution_id on public.dividend_payments ("institution_id");
create index if not exists idx_dividend_payments_member_id on public.dividend_payments ("member_id");
create index if not exists idx_dividend_payments_declaration_id on public.dividend_payments ("declaration_id");
create index if not exists idx_dividend_payments_payment_date on public.dividend_payments ("payment_date");
create index if not exists idx_institution_settings_institution_id on public.institution_settings ("institution_id");
create index if not exists idx_journal_entries_institution_id on public.journal_entries ("institution_id");
create index if not exists idx_journal_entries_date on public.journal_entries ("date");
create index if not exists idx_loans_institution_id on public.loans ("institution_id");
create index if not exists idx_loans_member_id on public.loans ("member_id");
create index if not exists idx_loan_applications_institution_id on public.loan_applications ("institution_id");
create index if not exists idx_loan_applications_member_id on public.loan_applications ("member_id");
create index if not exists idx_loan_payments_institution_id on public.loan_payments ("institution_id");
create index if not exists idx_loan_payments_member_id on public.loan_payments ("member_id");
create index if not exists idx_loan_payments_loan_id on public.loan_payments ("loan_id");
create index if not exists idx_loan_payments_payment_date on public.loan_payments ("payment_date");
create index if not exists idx_members_institution_id on public.members ("institution_id");
create index if not exists idx_member_accounts_institution_id on public.member_accounts ("institution_id");
create index if not exists idx_member_accounts_member_id on public.member_accounts ("member_id");
create index if not exists idx_member_messages_institution_id on public.member_messages ("institution_id");
create index if not exists idx_member_messages_date on public.member_messages ("date");
create index if not exists idx_member_payments_institution_id on public.member_payments ("institution_id");
create index if not exists idx_member_payments_member_id on public.member_payments ("member_id");
create index if not exists idx_member_payments_payment_date on public.member_payments ("payment_date");
create index if not exists idx_repayments_institution_id on public.repayments ("institution_id");
create index if not exists idx_repayments_member_id on public.repayments ("member_id");
create index if not exists idx_repayments_loan_id on public.repayments ("loan_id");
create index if not exists idx_repayments_payment_date on public.repayments ("payment_date");
create index if not exists idx_repayments_due_date on public.repayments ("due_date");
create index if not exists idx_shares_institution_id on public.shares ("institution_id");
create index if not exists idx_shares_member_id on public.shares ("member_id");
create index if not exists idx_share_schedules_institution_id on public.share_schedules ("institution_id");
create index if not exists idx_share_schedules_member_id on public.share_schedules ("member_id");
create index if not exists idx_share_transactions_institution_id on public.share_transactions ("institution_id");
create index if not exists idx_share_transactions_date on public.share_transactions ("date");

-- Updated timestamp triggers
drop trigger if exists trg_institutions_updated on public.institutions;
create trigger trg_institutions_updated before update on public.institutions for each row execute procedure public.set_updated_date();
drop trigger if exists trg_bank_deposits_updated on public.bank_deposits;
create trigger trg_bank_deposits_updated before update on public.bank_deposits for each row execute procedure public.set_updated_date();
drop trigger if exists trg_bank_withdrawals_updated on public.bank_withdrawals;
create trigger trg_bank_withdrawals_updated before update on public.bank_withdrawals for each row execute procedure public.set_updated_date();
drop trigger if exists trg_chart_of_accounts_updated on public.chart_of_accounts;
create trigger trg_chart_of_accounts_updated before update on public.chart_of_accounts for each row execute procedure public.set_updated_date();
drop trigger if exists trg_dividend_declarations_updated on public.dividend_declarations;
create trigger trg_dividend_declarations_updated before update on public.dividend_declarations for each row execute procedure public.set_updated_date();
drop trigger if exists trg_dividend_payments_updated on public.dividend_payments;
create trigger trg_dividend_payments_updated before update on public.dividend_payments for each row execute procedure public.set_updated_date();
drop trigger if exists trg_institution_settings_updated on public.institution_settings;
create trigger trg_institution_settings_updated before update on public.institution_settings for each row execute procedure public.set_updated_date();
drop trigger if exists trg_journal_entries_updated on public.journal_entries;
create trigger trg_journal_entries_updated before update on public.journal_entries for each row execute procedure public.set_updated_date();
drop trigger if exists trg_loans_updated on public.loans;
create trigger trg_loans_updated before update on public.loans for each row execute procedure public.set_updated_date();
drop trigger if exists trg_loan_applications_updated on public.loan_applications;
create trigger trg_loan_applications_updated before update on public.loan_applications for each row execute procedure public.set_updated_date();
drop trigger if exists trg_loan_payments_updated on public.loan_payments;
create trigger trg_loan_payments_updated before update on public.loan_payments for each row execute procedure public.set_updated_date();
drop trigger if exists trg_members_updated on public.members;
create trigger trg_members_updated before update on public.members for each row execute procedure public.set_updated_date();
drop trigger if exists trg_member_accounts_updated on public.member_accounts;
create trigger trg_member_accounts_updated before update on public.member_accounts for each row execute procedure public.set_updated_date();
drop trigger if exists trg_member_messages_updated on public.member_messages;
create trigger trg_member_messages_updated before update on public.member_messages for each row execute procedure public.set_updated_date();
drop trigger if exists trg_member_payments_updated on public.member_payments;
create trigger trg_member_payments_updated before update on public.member_payments for each row execute procedure public.set_updated_date();
drop trigger if exists trg_repayments_updated on public.repayments;
create trigger trg_repayments_updated before update on public.repayments for each row execute procedure public.set_updated_date();
drop trigger if exists trg_shares_updated on public.shares;
create trigger trg_shares_updated before update on public.shares for each row execute procedure public.set_updated_date();
drop trigger if exists trg_share_schedules_updated on public.share_schedules;
create trigger trg_share_schedules_updated before update on public.share_schedules for each row execute procedure public.set_updated_date();
drop trigger if exists trg_share_transactions_updated on public.share_transactions;
create trigger trg_share_transactions_updated before update on public.share_transactions for each row execute procedure public.set_updated_date();
drop trigger if exists trg_audit_logs_updated on public.audit_logs;
create trigger trg_audit_logs_updated before update on public.audit_logs for each row execute procedure public.set_updated_date();
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute procedure public.set_updated_date();

-- Authorization helpers
create or replace function public.current_user_institution_id() returns text language sql stable security definer set search_path=public as $$ select institution_id from public.profiles where id=auth.uid() limit 1; $$;
create or replace function public.current_user_member_id() returns text language sql stable security definer set search_path=public as $$ select member_id from public.profiles where id=auth.uid() limit 1; $$;
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select is_platform_admin or role='admin' from public.profiles where id=auth.uid()),false); $$;

-- Profiles RLS
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id=auth.uid() or public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id=auth.uid() or public.is_platform_admin()) with check (id=auth.uid() or public.is_platform_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id=auth.uid() or public.is_platform_admin());
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs for select to authenticated using (public.is_platform_admin());
alter table public.bank_deposits enable row level security;
drop policy if exists bank_deposits_select on public.bank_deposits;
create policy bank_deposits_select on public.bank_deposits for select to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists bank_deposits_insert on public.bank_deposits;
create policy bank_deposits_insert on public.bank_deposits for insert to authenticated with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists bank_deposits_update on public.bank_deposits;
create policy bank_deposits_update on public.bank_deposits for update to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id()) with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists bank_deposits_delete on public.bank_deposits;
create policy bank_deposits_delete on public.bank_deposits for delete to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
alter table public.bank_withdrawals enable row level security;
drop policy if exists bank_withdrawals_select on public.bank_withdrawals;
create policy bank_withdrawals_select on public.bank_withdrawals for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists bank_withdrawals_insert on public.bank_withdrawals;
create policy bank_withdrawals_insert on public.bank_withdrawals for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists bank_withdrawals_update on public.bank_withdrawals;
create policy bank_withdrawals_update on public.bank_withdrawals for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists bank_withdrawals_delete on public.bank_withdrawals;
create policy bank_withdrawals_delete on public.bank_withdrawals for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.chart_of_accounts enable row level security;
drop policy if exists chart_of_accounts_select on public.chart_of_accounts;
create policy chart_of_accounts_select on public.chart_of_accounts for select to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists chart_of_accounts_insert on public.chart_of_accounts;
create policy chart_of_accounts_insert on public.chart_of_accounts for insert to authenticated with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists chart_of_accounts_update on public.chart_of_accounts;
create policy chart_of_accounts_update on public.chart_of_accounts for update to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id()) with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists chart_of_accounts_delete on public.chart_of_accounts;
create policy chart_of_accounts_delete on public.chart_of_accounts for delete to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
alter table public.dividend_declarations enable row level security;
drop policy if exists dividend_declarations_select on public.dividend_declarations;
create policy dividend_declarations_select on public.dividend_declarations for select to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists dividend_declarations_insert on public.dividend_declarations;
create policy dividend_declarations_insert on public.dividend_declarations for insert to authenticated with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists dividend_declarations_update on public.dividend_declarations;
create policy dividend_declarations_update on public.dividend_declarations for update to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id()) with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists dividend_declarations_delete on public.dividend_declarations;
create policy dividend_declarations_delete on public.dividend_declarations for delete to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
alter table public.dividend_payments enable row level security;
drop policy if exists dividend_payments_select on public.dividend_payments;
create policy dividend_payments_select on public.dividend_payments for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists dividend_payments_insert on public.dividend_payments;
create policy dividend_payments_insert on public.dividend_payments for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists dividend_payments_update on public.dividend_payments;
create policy dividend_payments_update on public.dividend_payments for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists dividend_payments_delete on public.dividend_payments;
create policy dividend_payments_delete on public.dividend_payments for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.institutions enable row level security;
drop policy if exists institutions_select on public.institutions;
create policy institutions_select on public.institutions for select to authenticated using (public.is_platform_admin() or id=public.current_user_institution_id());
drop policy if exists institutions_insert on public.institutions;
create policy institutions_insert on public.institutions for insert to authenticated with check (public.is_platform_admin() or auth.uid() is not null);
drop policy if exists institutions_update on public.institutions;
create policy institutions_update on public.institutions for update to authenticated using (public.is_platform_admin() or id=public.current_user_institution_id()) with check (public.is_platform_admin() or id=public.current_user_institution_id());
drop policy if exists institutions_delete on public.institutions;
create policy institutions_delete on public.institutions for delete to authenticated using (public.is_platform_admin());
alter table public.institution_settings enable row level security;
drop policy if exists institution_settings_select on public.institution_settings;
create policy institution_settings_select on public.institution_settings for select to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists institution_settings_insert on public.institution_settings;
create policy institution_settings_insert on public.institution_settings for insert to authenticated with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists institution_settings_update on public.institution_settings;
create policy institution_settings_update on public.institution_settings for update to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id()) with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists institution_settings_delete on public.institution_settings;
create policy institution_settings_delete on public.institution_settings for delete to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
alter table public.journal_entries enable row level security;
drop policy if exists journal_entries_select on public.journal_entries;
create policy journal_entries_select on public.journal_entries for select to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists journal_entries_insert on public.journal_entries;
create policy journal_entries_insert on public.journal_entries for insert to authenticated with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists journal_entries_update on public.journal_entries;
create policy journal_entries_update on public.journal_entries for update to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id()) with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists journal_entries_delete on public.journal_entries;
create policy journal_entries_delete on public.journal_entries for delete to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
alter table public.loans enable row level security;
drop policy if exists loans_select on public.loans;
create policy loans_select on public.loans for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists loans_insert on public.loans;
create policy loans_insert on public.loans for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists loans_update on public.loans;
create policy loans_update on public.loans for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists loans_delete on public.loans;
create policy loans_delete on public.loans for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.loan_applications enable row level security;
drop policy if exists loan_applications_select on public.loan_applications;
create policy loan_applications_select on public.loan_applications for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists loan_applications_insert on public.loan_applications;
create policy loan_applications_insert on public.loan_applications for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists loan_applications_update on public.loan_applications;
create policy loan_applications_update on public.loan_applications for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists loan_applications_delete on public.loan_applications;
create policy loan_applications_delete on public.loan_applications for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.loan_payments enable row level security;
drop policy if exists loan_payments_select on public.loan_payments;
create policy loan_payments_select on public.loan_payments for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists loan_payments_insert on public.loan_payments;
create policy loan_payments_insert on public.loan_payments for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists loan_payments_update on public.loan_payments;
create policy loan_payments_update on public.loan_payments for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists loan_payments_delete on public.loan_payments;
create policy loan_payments_delete on public.loan_payments for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.members enable row level security;
drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or id=public.current_user_member_id())));
drop policy if exists members_insert on public.members;
create policy members_insert on public.members for insert to authenticated with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists members_update on public.members;
create policy members_update on public.members for update to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id()) with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
alter table public.member_accounts enable row level security;
drop policy if exists member_accounts_select on public.member_accounts;
create policy member_accounts_select on public.member_accounts for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists member_accounts_insert on public.member_accounts;
create policy member_accounts_insert on public.member_accounts for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists member_accounts_update on public.member_accounts;
create policy member_accounts_update on public.member_accounts for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists member_accounts_delete on public.member_accounts;
create policy member_accounts_delete on public.member_accounts for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.member_messages enable row level security;
drop policy if exists member_messages_select on public.member_messages;
create policy member_messages_select on public.member_messages for select to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists member_messages_insert on public.member_messages;
create policy member_messages_insert on public.member_messages for insert to authenticated with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists member_messages_update on public.member_messages;
create policy member_messages_update on public.member_messages for update to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id()) with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists member_messages_delete on public.member_messages;
create policy member_messages_delete on public.member_messages for delete to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
alter table public.member_payments enable row level security;
drop policy if exists member_payments_select on public.member_payments;
create policy member_payments_select on public.member_payments for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists member_payments_insert on public.member_payments;
create policy member_payments_insert on public.member_payments for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists member_payments_update on public.member_payments;
create policy member_payments_update on public.member_payments for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists member_payments_delete on public.member_payments;
create policy member_payments_delete on public.member_payments for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.repayments enable row level security;
drop policy if exists repayments_select on public.repayments;
create policy repayments_select on public.repayments for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists repayments_insert on public.repayments;
create policy repayments_insert on public.repayments for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists repayments_update on public.repayments;
create policy repayments_update on public.repayments for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists repayments_delete on public.repayments;
create policy repayments_delete on public.repayments for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.shares enable row level security;
drop policy if exists shares_select on public.shares;
create policy shares_select on public.shares for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists shares_insert on public.shares;
create policy shares_insert on public.shares for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists shares_update on public.shares;
create policy shares_update on public.shares for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists shares_delete on public.shares;
create policy shares_delete on public.shares for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.share_schedules enable row level security;
drop policy if exists share_schedules_select on public.share_schedules;
create policy share_schedules_select on public.share_schedules for select to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists share_schedules_insert on public.share_schedules;
create policy share_schedules_insert on public.share_schedules for insert to authenticated with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists share_schedules_update on public.share_schedules;
create policy share_schedules_update on public.share_schedules for update to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id()))) with check (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
drop policy if exists share_schedules_delete on public.share_schedules;
create policy share_schedules_delete on public.share_schedules for delete to authenticated using (public.is_platform_admin() or (institution_id=public.current_user_institution_id() and (coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member' or member_id=public.current_user_member_id())));
alter table public.share_transactions enable row level security;
drop policy if exists share_transactions_select on public.share_transactions;
create policy share_transactions_select on public.share_transactions for select to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists share_transactions_insert on public.share_transactions;
create policy share_transactions_insert on public.share_transactions for insert to authenticated with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists share_transactions_update on public.share_transactions;
create policy share_transactions_update on public.share_transactions for update to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id()) with check (public.is_platform_admin() or institution_id=public.current_user_institution_id());
drop policy if exists share_transactions_delete on public.share_transactions;
create policy share_transactions_delete on public.share_transactions for delete to authenticated using (public.is_platform_admin() or institution_id=public.current_user_institution_id());

-- Private document storage
insert into storage.buckets (id,name,public) values ('documents','documents',false) on conflict (id) do nothing;
drop policy if exists documents_insert_authenticated on storage.objects;
create policy documents_insert_authenticated on storage.objects for insert to authenticated with check (bucket_id='documents' and (storage.foldername(name))[1]='uploads' and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists documents_select_authenticated on storage.objects;
create policy documents_select_authenticated on storage.objects for select to authenticated using (bucket_id='documents' and owner_id=auth.uid()::text);
drop policy if exists documents_delete_authenticated on storage.objects;
create policy documents_delete_authenticated on storage.objects for delete to authenticated using (bucket_id='documents' and owner_id=auth.uid()::text);

-- Member guarantor access: a member may see/update applications where they are
-- the guarantor, without exposing the rest of the institution's applications.
drop policy if exists loan_applications_select on public.loan_applications;
create policy loan_applications_select on public.loan_applications for select to authenticated
using (
  public.is_platform_admin()
  or (
    institution_id = public.current_user_institution_id()
    and (
      coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member'
      or member_id = public.current_user_member_id()
      or guarantor_id = public.current_user_member_id()
    )
  )
);

drop policy if exists loan_applications_update on public.loan_applications;
create policy loan_applications_update on public.loan_applications for update to authenticated
using (
  public.is_platform_admin()
  or (
    institution_id = public.current_user_institution_id()
    and (
      coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member'
      or member_id = public.current_user_member_id()
      or guarantor_id = public.current_user_member_id()
    )
  )
)
with check (
  public.is_platform_admin()
  or (
    institution_id = public.current_user_institution_id()
    and (
      coalesce((select role from public.profiles where id=auth.uid()),'') <> 'member'
      or member_id = public.current_user_member_id()
      or guarantor_id = public.current_user_member_id()
    )
  )
);

-- Audit entries are write-only for authenticated application users; reads remain platform-owner scoped.
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert to authenticated
with check (public.is_platform_admin() or actor_id = auth.uid()::text);

-- A normal user can create an institution only before being linked to one.
drop policy if exists institutions_insert on public.institutions;
create policy institutions_insert on public.institutions for insert to authenticated
with check (public.is_platform_admin() or public.current_user_institution_id() is null);
