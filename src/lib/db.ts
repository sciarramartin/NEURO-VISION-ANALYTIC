import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export async function getDB(): Promise<Database> {
  if (dbInstance) return dbInstance;

  // Save the database file in the project's root folder
  const dbPath = path.join(process.cwd(), 'parkinson.db');
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Execute migrations to create tables if they do not exist yet
  await dbInstance.exec(`
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
  const mockPatientCount = await dbInstance.get("SELECT COUNT(*) as count FROM patients WHERE id = 'mock-p1'");
  if (mockPatientCount && mockPatientCount.count === 0) {
    const now = new Date().toISOString();
    
    // Seed default patients
    await dbInstance.run(`
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

    await dbInstance.run(`
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

  return dbInstance;
}
