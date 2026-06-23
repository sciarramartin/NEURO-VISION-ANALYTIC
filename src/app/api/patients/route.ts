import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDB();
    
    // Select all patients and count their session records using a left join
    const patients = await db.all(`
      SELECT p.id, p.name, p.birth_date, p.created_at, COUNT(s.id) as sessions_count 
      FROM patients p 
      LEFT JOIN sessions s ON p.id = s.patient_id 
      GROUP BY p.id 
      ORDER BY p.created_at DESC
    `);
    
    return NextResponse.json(patients);
  } catch (err: any) {
    console.error('API Patients GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, birth_date } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const db = await getDB();
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    await db.run(
      `INSERT INTO patients (id, name, birth_date, created_at) VALUES (?, ?, ?, ?)`,
      [id, name.trim(), birth_date || null, created_at]
    );

    const newPatient = {
      id,
      name: name.trim(),
      birth_date: birth_date || null,
      created_at,
      sessions_count: 0
    };

    return NextResponse.json(newPatient);
  } catch (err: any) {
    console.error('API Patients POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
