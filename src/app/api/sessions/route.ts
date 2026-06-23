import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const limitParam = searchParams.get('limit');

    const db = await getDB();
    let sessions;

    if (patientId) {
      // Fetch sessions for a specific patient, sorted chronologically ascending for charts
      sessions = await db.all(
        `SELECT * FROM sessions WHERE patient_id = ? ORDER BY created_at ASC`,
        [patientId]
      );
    } else {
      // Fetch recent sessions
      const limit = limitParam ? parseInt(limitParam) : 10;
      sessions = await db.all(
        `SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?`,
        [limit]
      );
    }

    return NextResponse.json(sessions);
  } catch (err: any) {
    console.error('API Sessions GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionData = await request.json();
    const {
      patient_id,
      modo,
      region,
      lado,
      tiempo_medicion,
      angulo_min,
      angulo_max,
      angulo_promedio,
      velocidad_max,
      frecuencia_temblor,
      amplitud_temblor,
      asimetria_index,
      datos_angulos
    } = sessionData;

    if (!patient_id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    const db = await getDB();
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
        id, patient_id, modo, region, lado, tiempo_medicion,
        angulo_min, angulo_max, angulo_promedio, velocidad_max,
        frecuencia_temblor, amplitud_temblor, asimetria_index || null,
        datos_angulos || '', created_at
      ]
    );

    const newSession = {
      id,
      patient_id,
      modo,
      region,
      lado,
      tiempo_medicion,
      angulo_min,
      angulo_max,
      angulo_promedio,
      velocidad_max,
      frecuencia_temblor,
      amplitud_temblor,
      asimetria_index: asimetria_index || null,
      datos_angulos: datos_angulos || '',
      created_at
    };

    return NextResponse.json(newSession);
  } catch (err: any) {
    console.error('API Sessions POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const db = await getDB();
    await db.run(`DELETE FROM sessions WHERE id = ?`, [id]);

    return NextResponse.json({ success: true, message: 'Session deleted successfully' });
  } catch (err: any) {
    console.error('API Sessions DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
