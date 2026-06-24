import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const envKeys = Object.keys(process.env);
    const databaseKeys = envKeys.filter(k => 
      k.includes('DATABASE') || 
      k.includes('POSTGRES') || 
      k.includes('SUPABASE') || 
      k.includes('URL') ||
      k.includes('NEON')
    );

    const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    return NextResponse.json({
      success: true,
      message: 'Diagnostic check',
      envKeysPresent: databaseKeys,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      postgresUrlLength: postgresUrl ? postgresUrl.length : 0,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      isVercel: process.env.VERCEL === '1',
      nodeEnv: process.env.NODE_ENV
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
