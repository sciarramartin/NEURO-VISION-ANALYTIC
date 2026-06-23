export type UserRole = 'admin' | 'patient';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Patient {
  id: string;
  profile_id: string | null;
  name: string;
  birth_date: string | null;
  clinician_id: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  patient_id: string;
  modo: 'PRE' | 'POST';
  region: 'CEJA' | 'PARPADO' | 'BOCA' | 'NARIZ';
  lado: 'IZQUIERDA' | 'DERECHA';
  tiempo_medicion: number;
  angulo_min: number;
  angulo_max: number;
  angulo_promedio: number;
  velocidad_max: number;
  frecuencia_temblor: number | null; // Hz
  amplitud_temblor: number | null;   // Peak spectral power
  asimetria_index: number | null;    // % Left vs Right
  datos_angulos: string;             // Semicolon-separated decimal angles
  created_at: string;
}
