import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  try {
    const { certificateId } = await params;

    if (!certificateId) {
      return NextResponse.json({ status: 'not_found', error: 'Certificate ID is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Query the certificates table
    const { data: cert, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('certificate_id', certificateId)
      .maybeSingle();

    if (error) {
      console.error('Error verifying certificate:', error);
      return NextResponse.json({ status: 'error', error: 'Database query failed' }, { status: 500 });
    }

    if (!cert) {
      return NextResponse.json({ 
        status: 'not_found', 
        message: 'Certificate Not Found',
        verified: false
      });
    }

    // Check status
    if (cert.verification_status === 'revoked') {
      return NextResponse.json({
        status: 'revoked',
        message: 'Certificate Revoked',
        verified: false,
        certificate: {
          student_name: cert.student_name,
          course_name: cert.course_name,
          certificate_id: cert.certificate_id,
          award_date: cert.award_date,
          issued_at: cert.issued_at,
          verification_status: cert.verification_status,
        }
      });
    }

    // Normal active/verified certificate
    return NextResponse.json({
      status: 'verified',
      message: 'Certificate Verified',
      verified: true,
      certificate: cert
    });

  } catch (err: any) {
    console.error('Failed to verify certificate:', err);
    return NextResponse.json({ 
      status: 'error', 
      error: 'Internal server error',
      details: err.message || String(err)
    }, { status: 500 });
  }
}
