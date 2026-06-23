-- Database schema for Parkinson Analytic Web App
-- Run this script in the Supabase SQL Editor to set up your tables, triggers, and Row-Level Security (RLS) policies.

-- 1. Create custom user roles type
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'patient');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Profiles table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'patient'::user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Patients table (managed by admins/clinicians)
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Optional patient login link
    name TEXT NOT NULL,
    birth_date DATE,
    clinician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Sessions table (facial movement logs)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    modo VARCHAR(10) NOT NULL, -- 'PRE' or 'POST'
    region VARCHAR(20) NOT NULL, -- 'CEJA', 'PARPADO', 'BOCA', 'NARIZ'
    lado VARCHAR(10) NOT NULL, -- 'IZQUIERDA' or 'DERECHA'
    tiempo_medicion REAL NOT NULL,
    angulo_min REAL NOT NULL,
    angulo_max REAL NOT NULL,
    angulo_promedio REAL NOT NULL,
    velocidad_max REAL NOT NULL,
    frecuencia_temblor REAL, -- Hz from FFT
    amplitud_temblor REAL, -- peak power from FFT
    asimetria_index REAL,
    datos_angulos TEXT NOT NULL, -- semi-colon separated raw angles
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Trigger: Sync Supabase Auth users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'patient'::user_role)
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies

-- Profiles Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    );

-- Patients Policies
DROP POLICY IF EXISTS "Patients can view own details" ON public.patients;
CREATE POLICY "Patients can view own details" ON public.patients
    FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all patients" ON public.patients;
CREATE POLICY "Admins can manage all patients" ON public.patients
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    );

-- Sessions Policies
DROP POLICY IF EXISTS "Patients can view own sessions" ON public.sessions;
CREATE POLICY "Patients can view own sessions" ON public.sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.patients 
            WHERE public.patients.id = public.sessions.patient_id AND public.patients.profile_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can manage all sessions" ON public.sessions;
CREATE POLICY "Admins can manage all sessions" ON public.sessions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    );
