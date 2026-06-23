import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;

    const db = await getDB();
    const sessions = await db.getSessions(patientId, limit);
    return NextResponse.json(sessions);
  } catch (err: any) {
    console.error('API Sessions GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionData = await request.json();
    if (!sessionData.patient_id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    const db = await getDB();
    const newSession = await db.createSession(sessionData);
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
    await db.deleteSession(id);
    return NextResponse.json({ success: true, message: 'Session deleted successfully' });
  } catch (err: any) {
    console.error('API Sessions DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
