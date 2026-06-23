-- Database schema for Parkinson Analytic Web App (Neon PostgreSQL Version)
-- Run this script in the Neon SQL Editor or Vercel Storage query tool to set up your tables.

-- 1. Patients table (managed by admins/clinicians)
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    birth_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Sessions table (facial movement logs)
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
