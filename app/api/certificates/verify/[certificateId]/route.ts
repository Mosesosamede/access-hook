import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getCandidateIds(rawId: string): string[] {
  const candidates = [rawId];
  const match = rawId.match(/^(DELX-\d{4})-(\d+)$/i);
  if (match) {
    const prefix = match[1];
    const numStr = match[2];
    const num = parseInt(numStr, 10);
    const padded5 = `${prefix}-${String(num).padStart(5, '0')}`;
    const padded6 = `${prefix}-${String(num).padStart(6, '0')}`;
    if (!candidates.includes(padded5)) candidates.push(padded5);
    if (!candidates.includes(padded6)) candidates.push(padded6);
  }
  return candidates;
}

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
    const candidateIds = getCandidateIds(certificateId);

    // Query the certificates table with candidates
    let cert = null;
    let queryError = null;

    for (const cid of candidateIds) {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('certificate_id', cid)
        .maybeSingle();

      if (data) {
        cert = data;
        break;
      }
      if (error && !queryError) {
        queryError = error;
      }
    }

    if (queryError && !cert) {
      console.error('Error verifying certificate:', queryError);
      return NextResponse.json({ status: 'error', error: 'Database query failed' }, { status: 500 });
    }

    if (!cert) {
      return NextResponse.json({ 
        status: 'not_found', 
        message: 'Certificate Not Found',
        verified: false,
        certificateId
      }, { status: 404 });
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
