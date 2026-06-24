import { createClient } from '@supabase/supabase-js';

export interface DBClient {
  getPatients(): Promise<any[]>;
  createPatient(name: string, birth_date?: string): Promise<any>;
  getSessions(patientId?: string, limit?: number): Promise<any[]>;
  createSession(session: any): Promise<any>;
  deleteSession(id: string): Promise<any>;
}

let dbInstance: DBClient | null = null;

export async function getDB(): Promise<DBClient> {
  if (dbInstance) return dbInstance;

  // Determine if Neon PostgreSQL database is configured
  const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const hasPostgres = !!postgresUrl;

  // Determine if Supabase URL and Anon Key are configured
  const hasSupabaseEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co' &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

  const isVercelOrProdBuild = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  if (hasPostgres) {
    console.log('Database running in Neon PostgreSQL production mode (via Prisma).');
    dbInstance = getPrismaClient();
  } else if (hasSupabaseEnv) {
    console.log('Database running in Supabase production mode.');
    dbInstance = getSupabaseClient();
  } else if (isVercelOrProdBuild) {
    console.warn(
      'Database running in Vercel mode but database environment variables are missing. Falling back to temporary in-memory mock to prevent GLIBC binary loading issues.'
    );
    dbInstance = getMockMemoryClient();
  } else {
    console.log('Database running in local offline SQLite mode.');
    dbInstance = await getSQLiteClient();
  }

  return dbInstance;
}

// 1. Neon/PostgreSQL Implementation using Prisma ORM
function getPrismaClient(): DBClient {
  const { prisma } = require('./prisma');

  return {
    async getPatients() {
      const patients = await prisma.patient.findMany({
        include: {
          sessions: {
            select: { id: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      return patients.map((p: any) => ({
        id: p.id,
        name: p.name,
        birth_date: p.birthDate ? p.birthDate.toISOString().split('T')[0] : null,
        created_at: p.createdAt.toISOString(),
        sessions_count: p.sessions.length
      }));
    },

    async createPatient(name, birth_date) {
      const p = await prisma.patient.create({
        data: {
          name,
          birthDate: birth_date ? new Date(birth_date) : null
        }
      });
      return {
        id: p.id,
        name: p.name,
        birth_date: p.birthDate ? p.birthDate.toISOString().split('T')[0] : null,
        created_at: p.createdAt.toISOString(),
        sessions_count: 0
      };
    },

    async getSessions(patientId, limit) {
      const sessions = await prisma.session.findMany({
        where: patientId ? { patientId } : undefined,
        orderBy: {
          createdAt: patientId ? 'asc' : 'desc'
        },
        take: patientId ? undefined : (limit || 10)
      });
      return sessions.map((s: any) => ({
        id: s.id,
        patient_id: s.patientId,
        modo: s.modo,
        region: s.region,
        lado: s.lado,
        tiempo_medicion: s.tiempoMedicion,
        angulo_min: s.anguloMin,
        angulo_max: s.anguloMax,
        angulo_promedio: s.anguloPromedio,
        velocidad_max: s.velocidadMax,
        frecuencia_temblor: s.frecuenciaTemblor,
        amplitud_temblor: s.amplitudTemblor,
        asimetria_index: s.asimetriaIndex,
        datos_angulos: s.datosAngulos,
        created_at: s.createdAt.toISOString()
      }));
    },

    async createSession(session) {
      const s = await prisma.session.create({
        data: {
          patientId: session.patient_id,
          modo: session.modo,
          region: session.region,
          lado: session.lado,
          tiempoMedicion: Number(session.tiempo_medicion),
          anguloMin: Number(session.angulo_min),
          anguloMax: Number(session.angulo_max),
          anguloPromedio: Number(session.angulo_promedio),
          velocidadMax: Number(session.velocidad_max),
          frecuenciaTemblor: session.frecuencia_temblor ? Number(session.frecuencia_temblor) : null,
          amplitudTemblor: session.amplitud_temblor ? Number(session.amplitud_temblor) : null,
          asimetriaIndex: session.asimetria_index ? Number(session.asimetria_index) : null,
          datosAngulos: session.datos_angulos || ''
        }
      });
      return {
        id: s.id,
        patient_id: s.patientId,
        modo: s.modo,
        region: s.region,
        lado: s.lado,
        tiempo_medicion: s.tiempoMedicion,
        angulo_min: s.anguloMin,
        angulo_max: s.anguloMax,
        angulo_promedio: s.anguloPromedio,
        velocidad_max: s.velocidadMax,
        frecuencia_temblor: s.frecuenciaTemblor,
        amplitud_temblor: s.amplitudTemblor,
        asimetria_index: s.asimetriaIndex,
        datos_angulos: s.datosAngulos,
        created_at: s.createdAt.toISOString()
      };
    },

    async deleteSession(id) {
      await prisma.session.delete({
        where: { id }
      });
      return { success: true };
    }
  };
}


// 1. Supabase Implementation
function getSupabaseClient(): DBClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
  const serverSupabase = createClient(supabaseUrl, supabaseKey);

  return {
    async getPatients() {
      const { data: patients, error: pError } = await serverSupabase
        .from('patients')
        .select('id, name, birth_date, created_at');

      if (pError) throw pError;

      const { data: sessions, error: sError } = await serverSupabase
        .from('sessions')
        .select('patient_id');

      if (sError) throw sError;

      const counts = sessions.reduce((acc: Record<string, number>, s) => {
        acc[s.patient_id] = (acc[s.patient_id] || 0) + 1;
        return acc;
      }, {});

      return (patients || []).map(p => ({
        ...p,
        sessions_count: counts[p.id] || 0
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },

    async createPatient(name, birth_date) {
      const { data, error } = await serverSupabase
        .from('patients')
        .insert({
          name,
          birth_date: birth_date || null
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, sessions_count: 0 };
    },

    async getSessions(patientId, limit) {
      let query = serverSupabase.from('sessions').select('*');
      if (patientId) {
        query = query.eq('patient_id', patientId).order('created_at', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false }).limit(limit || 10);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async createSession(session) {
      const { data, error } = await serverSupabase
        .from('sessions')
        .insert({
          patient_id: session.patient_id,
          modo: session.modo,
          region: session.region,
          lado: session.lado,
          tiempo_medicion: session.tiempo_medicion,
          angulo_min: session.angulo_min,
          angulo_max: session.angulo_max,
          angulo_promedio: session.angulo_promedio,
          velocidad_max: session.velocidad_max,
          frecuencia_temblor: session.frecuencia_temblor,
          amplitud_temblor: session.amplitud_temblor,
          asimetria_index: session.asimetria_index || null,
          datos_angulos: session.datos_angulos || ''
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async deleteSession(id) {
      const { error } = await serverSupabase
        .from('sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    }
  };
}

// 2. SQLite Implementation using Dynamic Imports
async function getSQLiteClient(): Promise<DBClient> {
  const sqlite3 = (await import('sqlite3')).default;
  const { open } = await import('sqlite');
  const path = (await import('path')).default;

  const dbPath = path.join(process.cwd(), 'parkinson.db');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create tables if they do not exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      birth_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      modo TEXT NOT NULL,
      region TEXT NOT NULL,
      lado TEXT NOT NULL,
      tiempo_medicion REAL NOT NULL,
      angulo_min REAL NOT NULL,
      angulo_max REAL NOT NULL,
      angulo_promedio REAL NOT NULL,
      velocidad_max REAL NOT NULL,
      frecuencia_temblor REAL NOT NULL,
      amplitud_temblor REAL NOT NULL,
      asimetria_index REAL,
      datos_angulos TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
    );
  `);

  // Seeding: Check if mock patients are missing
  const mockPatientCount = await db.get("SELECT COUNT(*) as count FROM patients WHERE id = 'mock-p1'");
  if (mockPatientCount && mockPatientCount.count === 0) {
    const now = new Date().toISOString();
    
    // Seed default patients
    await db.run(`
      INSERT INTO patients (id, name, birth_date, created_at)
      VALUES 
        ('mock-p1', 'Paciente A (Simulado)', '1960-04-12', ?),
        ('mock-p2', 'Paciente B (Simulado)', '1955-08-22', ?)
    `, [now, now]);

    // Seed default session logs for Paciente A and Paciente B
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const threeDaysAgoPlusHalfHour = new Date(Date.now() - 3 * 86400000 + 1800000).toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const yesterdayPlusHalfHour = new Date(Date.now() - 86400000 + 1800000).toISOString();

    await db.run(`
      INSERT INTO sessions (
        id, patient_id, modo, region, lado, tiempo_medicion,
        angulo_min, angulo_max, angulo_promedio, velocidad_max,
        frecuencia_temblor, amplitud_temblor, asimetria_index,
        datos_angulos, created_at
      ) VALUES 
        ('sess-1', 'mock-p1', 'PRE', 'CEJA', 'IZQUIERDA', 8.5, 135.2, 154.1, 144.5, 42.1, 5.2, 1.8, NULL, '0,140;1,142;2,141;3,138;4,145;5,143;6,150;7,148;8,154', ?),
        ('sess-2', 'mock-p1', 'POST', 'CEJA', 'IZQUIERDA', 9.1, 132.1, 159.4, 145.8, 56.4, 0.0, 0.0, NULL, '0,142;1,145;2,148;3,150;4,152;5,155;6,158;7,159;8,157', ?),
        ('sess-3', 'mock-p1', 'PRE', 'CEJA', 'IZQUIERDA', 8.2, 138.4, 151.2, 142.8, 38.2, 5.5, 2.2, NULL, '0,140;1,141;2,139;3,143;4,142;5,148;6,150;7,151', ?),
        ('sess-4', 'mock-p1', 'POST', 'CEJA', 'IZQUIERDA', 8.9, 134.1, 161.5, 147.2, 60.1, 0.0, 0.0, NULL, '0,140;1,144;2,148;3,152;4,156;5,160;6,161;7,159', ?),
        ('sess-5', 'mock-p2', 'PRE', 'BOCA', 'DERECHA', 10.0, 110.4, 125.8, 118.2, 30.5, 4.8, 2.1, NULL, '', ?)
    `, [threeDaysAgo, threeDaysAgoPlusHalfHour, yesterday, yesterdayPlusHalfHour, yesterday]);
  }

  return {
    async getPatients() {
      return db.all(`
        SELECT p.id, p.name, p.birth_date, p.created_at, COUNT(s.id) as sessions_count 
        FROM patients p 
        LEFT JOIN sessions s ON p.id = s.patient_id 
        GROUP BY p.id 
        ORDER BY p.created_at DESC
      `);
    },
    async createPatient(name, birth_date) {
      const id = crypto.randomUUID();
      const created_at = new Date().toISOString();
      await db.run(
        `INSERT INTO patients (id, name, birth_date, created_at) VALUES (?, ?, ?, ?)`,
        [id, name, birth_date || null, created_at]
      );
      return { id, name, birth_date, created_at, sessions_count: 0 };
    },
    async getSessions(patientId, limit) {
      if (patientId) {
        return db.all(
          `SELECT * FROM sessions WHERE patient_id = ? ORDER BY created_at ASC`,
          [patientId]
        );
      } else {
        const lim = limit || 10;
        return db.all(
          `SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?`,
          [lim]
        );
      }
    },
    async createSession(session) {
      const id = crypto.randomUUID();
      const created_at = new Date().toISOString();
      await db.run(
        `INSERT INTO sessions (
          id, patient_id, modo, region, lado, tiempo_medicion, 
          angulo_min, angulo_max, angulo_promedio, velocidad_max, 
          frecuencia_temblor, amplitud_temblor, asimetria_index, 
          datos_angulos, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, session.patient_id, session.modo, session.region, session.lado, session.tiempo_medicion,
          session.angulo_min, session.angulo_max, session.angulo_promedio, session.velocidad_max,
          session.frecuencia_temblor, session.amplitud_temblor, session.asimetria_index || null,
          session.datos_angulos || '', created_at
        ]
      );
      return { id, ...session, created_at };
    },
    async deleteSession(id) {
      await db.run(`DELETE FROM sessions WHERE id = ?`, [id]);
      return { success: true };
    }
  };
}

// 3. Temporary In-Memory Mock Implementation for Vercel builds
function getMockMemoryClient(): DBClient {
  return {
    async getPatients() {
      return [
        { id: 'mock-p1', name: 'Paciente A (Simulado)', birth_date: '1960-04-12', sessions_count: 3 },
        { id: 'mock-p2', name: 'Paciente B (Simulado)', birth_date: '1955-08-22', sessions_count: 1 }
      ];
    },
    async createPatient(name, birth_date) {
      return {
        id: `mock-${Date.now()}`,
        name,
        birth_date: birth_date || 'N/A',
        created_at: new Date().toISOString(),
        sessions_count: 0
      };
    },
    async getSessions(patientId, limit) {
      const allMock = [
        {
          id: 'sess-1',
          patient_id: 'mock-p1',
          modo: 'PRE',
          region: 'CEJA',
          lado: 'IZQUIERDA',
          tiempo_medicion: 8.5,
          angulo_min: 135.2,
          angulo_max: 154.1,
          angulo_promedio: 144.5,
          velocidad_max: 42.1,
          frecuencia_temblor: 5.2,
          amplitud_temblor: 1.8,
          asimetria_index: null,
          datos_angulos: '0,140;1,142;2,141;3,138;4,145;5,143;6,150;7,148;8,154',
          created_at: new Date(Date.now() - 3 * 86400000).toISOString()
        },
        {
          id: 'sess-2',
          patient_id: 'mock-p1',
          modo: 'POST',
          region: 'CEJA',
          lado: 'IZQUIERDA',
          tiempo_medicion: 9.1,
          angulo_min: 132.1,
          angulo_max: 159.4,
          angulo_promedio: 145.8,
          velocidad_max: 56.4,
          frecuencia_temblor: 0,
          amplitud_temblor: 0,
          asimetria_index: null,
          datos_angulos: '0,142;1,145;2,148;3,150;4,152;5,155;6,158;7,159;8,157',
          created_at: new Date(Date.now() - 3 * 86400000 + 1800000).toISOString()
        },
        {
          id: 'sess-3',
          patient_id: 'mock-p1',
          modo: 'PRE',
          region: 'CEJA',
          lado: 'IZQUIERDA',
          tiempo_medicion: 8.2,
          angulo_min: 138.4,
          angulo_max: 151.2,
          angulo_promedio: 142.8,
          velocidad_max: 38.2,
          frecuencia_temblor: 5.5,
          amplitud_temblor: 2.2,
          asimetria_index: null,
          datos_angulos: '0,140;1,141;2,139;3,143;4,142;5,148;6,150;7,151',
          created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'sess-4',
          patient_id: 'mock-p1',
          modo: 'POST',
          region: 'CEJA',
          lado: 'IZQUIERDA',
          tiempo_medicion: 8.9,
          angulo_min: 134.1,
          angulo_max: 161.5,
          angulo_promedio: 147.2,
          velocidad_max: 60.1,
          frecuencia_temblor: 0,
          amplitud_temblor: 0,
          asimetria_index: null,
          datos_angulos: '0,140;1,144;2,148;3,152;4,156;5,160;6,161;7,159',
          created_at: new Date(Date.now() - 86400000 + 1800000).toISOString()
        },
        {
          id: 'sess-5',
          patient_id: 'mock-p2',
          modo: 'PRE',
          region: 'BOCA',
          lado: 'DERECHA',
          tiempo_medicion: 10.0,
          angulo_min: 110.4,
          angulo_max: 125.8,
          angulo_promedio: 118.2,
          velocidad_max: 30.5,
          frecuencia_temblor: 4.8,
          amplitud_temblor: 2.1,
          asimetria_index: null,
          datos_angulos: '',
          created_at: new Date(Date.now() - 86400000).toISOString()
        }
      ];

      if (patientId) {
        return allMock.filter(s => s.patient_id === patientId);
      } else {
        return allMock.slice(0, limit || 10);
      }
    },
    async createSession(session) {
      return {
        id: `sess-${Date.now()}`,
        ...session,
        created_at: new Date().toISOString()
      };
    },
    async deleteSession(id) {
      return { success: true };
    }
  };
}
