-- ============================================================================
-- SWASTHYA AI (MEDIKIOSK) - SUPABASE DATABASE MIGRATION & RLS POLICIES
-- ============================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. DOCTORS TABLE
CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  department text NOT NULL DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

-- 3. PATIENTS TABLE
CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  age integer,
  phone text,
  abha_id text,
  language_pref text DEFAULT 'hi',
  created_at timestamptz DEFAULT now()
);

-- 4. INTERVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  department text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'in_interview',
  structured_state jsonb DEFAULT '{}'::jsonb,
  transcript jsonb DEFAULT '[]'::jsonb,
  symptom_tags text[] DEFAULT ARRAY[]::text[],
  red_flag boolean DEFAULT false,
  red_flag_reason text,
  summary jsonb DEFAULT '{}'::jsonb,
  opd_token text,
  assigned_doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid REFERENCES public.interviews(id) ON DELETE CASCADE,
  storage_path text,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  doc_type text,
  created_at timestamptz DEFAULT now()
);

-- Create Indexes for High Performance Triage & Doctor Queue
CREATE INDEX IF NOT EXISTS idx_interviews_status ON public.interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_red_flag ON public.interviews(red_flag);
CREATE INDEX IF NOT EXISTS idx_interviews_updated_at ON public.interviews(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_interview_id ON public.documents(interview_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Kiosk Intake, Doctor Auth, & Realtime
DO $$
BEGIN
  -- Doctors Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doctors' AND policyname = 'Allow public read for doctors') THEN
    CREATE POLICY "Allow public read for doctors" ON public.doctors FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doctors' AND policyname = 'Allow auth insert/update for doctors') THEN
    CREATE POLICY "Allow auth insert/update for doctors" ON public.doctors FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Patients Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patients' AND policyname = 'Allow all operations on patients') THEN
    CREATE POLICY "Allow all operations on patients" ON public.patients FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Interviews Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'interviews' AND policyname = 'Allow all operations on interviews') THEN
    CREATE POLICY "Allow all operations on interviews" ON public.interviews FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Documents Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'Allow all operations on documents') THEN
    CREATE POLICY "Allow all operations on documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Enable Realtime for interviews
ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;

-- Insert / create "documents" storage bucket if not present
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to "documents" storage bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public uploads to documents bucket') THEN
    CREATE POLICY "Allow public uploads to documents bucket" ON storage.objects
    FOR ALL USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');
  END IF;
END $$;
