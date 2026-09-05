import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const certificateId = searchParams.get('id') || searchParams.get('applicantId');

    if (!certificateId) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const bucketName = 'allcertification';

    let storagePath: string | null = null;
    let certIdFound = certificateId;

    const { data: cert } = await supabase
      .from('certificates')
      .select('*')
      .or(`certificate_id.eq.${certificateId},id.eq.${certificateId},applicant_id.eq.${certificateId}`)
      .maybeSingle();

    if (cert) {
      storagePath = cert.storage_path;
      certIdFound = cert.certificate_id || certificateId;
    } else {
      const { data: applicant } = await supabase
        .from('applicants')
        .select('*')
        .or(`id.eq.${certificateId},readiness_certificate_id.eq.${certificateId}`)
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
      }
    }

    if (!storagePath && certificateId.includes('certificates/')) {
      storagePath = certificateId;
    }

    if (!storagePath) {
      console.warn(`[CERTIFICATE VIEW] Certificate record not found for: ${certificateId}`);
      return NextResponse.json({ error: 'Certificate record not found' }, { status: 404 });
    }

    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(bucketName)
      .download(storagePath);

    if (downloadErr || !fileData) {
      console.warn(`[CERTIFICATE VIEW] PDF not found in Storage for path '${storagePath}':`, downloadErr?.message);
      return NextResponse.json({ error: 'Certificate file not found' }, { status: 404 });
    }

    const pdfBuffer = await fileData.arrayBuffer();
    const filename = `${certIdFound}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (err: any) {
    console.error('Error viewing certificate:', err);
    return NextResponse.json({ error: 'Unable to retrieve certificate' }, { status: 500 });
  }
}
