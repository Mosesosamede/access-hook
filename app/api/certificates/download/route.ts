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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const certificateId = searchParams.get('id') || searchParams.get('applicantId');

    if (!certificateId) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const bucketName = 'allcertification';
    const candidateIds = getCandidateIds(certificateId);

    let storagePath: string | null = null;
    let certIdFound = certificateId;
    let cert = null;

    // 1. Search certificates table across candidates
    for (const cid of candidateIds) {
      const { data } = await supabase
        .from('certificates')
        .select('*')
        .or(`certificate_id.eq.${cid},id.eq.${cid},applicant_id.eq.${cid}`)
        .maybeSingle();

      if (data) {
        cert = data;
        storagePath = data.storage_path;
        certIdFound = data.certificate_id || cid;
        break;
      }
    }

    // 2. If not found in certificates table, search applicants table
    if (!cert) {
      for (const cid of candidateIds) {
        const { data: applicant } = await supabase
          .from('applicants')
          .select('*')
          .or(`id.eq.${cid},readiness_certificate_id.eq.${cid}`)
          .maybeSingle();

        if (applicant) {
          if (applicant.readiness_certificate_url) {
            const marker = '/allcertification/';
            const idx = applicant.readiness_certificate_url.indexOf(marker);
            if (idx !== -1) {
              storagePath = applicant.readiness_certificate_url.substring(idx + marker.length);
            } else {
              const parts = applicant.readiness_certificate_url.split('/');
              const certIdx = parts.indexOf('certificates');
              if (certIdx !== -1) {
                storagePath = parts.slice(certIdx).join('/');
              }
            }
          }
          if (applicant.readiness_certificate_id) {
            certIdFound = applicant.readiness_certificate_id;
            const { data: certByReadiness } = await supabase
              .from('certificates')
              .select('*')
              .eq('certificate_id', applicant.readiness_certificate_id)
              .maybeSingle();
            if (certByReadiness?.storage_path) {
              storagePath = certByReadiness.storage_path;
            }
          }
          break;
        }
      }
    }

    if (!storagePath && certificateId.includes('certificates/')) {
      storagePath = certificateId;
    }

    if (!storagePath) {
      console.warn(`[CERTIFICATE DOWNLOAD] Certificate record not found for: ${certificateId}`);
      return NextResponse.json({
        error: 'Certificate record not found',
        certificateId,
        reason: 'No certificate record or readiness certificate URL exists for this ID or applicant'
      }, { status: 404 });
    }

    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(bucketName)
      .download(storagePath);

    if (downloadErr || !fileData) {
      console.warn(`[CERTIFICATE DOWNLOAD] PDF not found in Storage for path '${storagePath}':`, downloadErr?.message);
      return NextResponse.json({
        error: 'Certificate PDF not found in Storage',
        certificateId: certIdFound,
        storagePath
      }, { status: 404 });
    }

    const pdfBuffer = await fileData.arrayBuffer();
    const filename = `${certIdFound}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (err: any) {
    console.error('Error downloading certificate:', err);
    return NextResponse.json({ error: 'Unable to retrieve certificate', details: err.message }, { status: 500 });
  }
}
