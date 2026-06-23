import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDB();
    const patients = await db.getPatients();
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
    const newPatient = await db.createPatient(name.trim(), birth_date);
    return NextResponse.json(newPatient);
  } catch (err: any) {
    console.error('API Patients POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
