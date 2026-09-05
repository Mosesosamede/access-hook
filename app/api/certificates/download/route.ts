import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const certificateId = searchParams.get('id');

    if (!certificateId) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const bucketName = 'allcertification';

    // 1. Find the certificate in the certificates table
    const { data: cert, error } = await supabase
      .from('certificates')
      .select('*')
      .or(`certificate_id.eq.${certificateId},id.eq.${certificateId},applicant_id.eq.${certificateId}`)
      .maybeSingle();

    if (error || !cert) {
      console.warn(`[CERTIFICATE] Record not found for ID: ${certificateId}`);
      return NextResponse.json({ error: 'Certificate record not found' }, { status: 404 });
    }

    // 2. Read its storage_path
    const storagePath = cert.storage_path;
    if (!storagePath) {
      console.warn(`[CERTIFICATE] Storage path missing for certificate: ${certificateId}`);
      return NextResponse.json({ error: 'Certificate PDF not found in Storage' }, { status: 404 });
    }

    // 3. Download that exact file from the allcertification bucket
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(bucketName)
      .download(storagePath);

    if (downloadErr || !fileData) {
      console.warn(`[CERTIFICATE] Storage download failed for path '${storagePath}':`, downloadErr?.message);
      return NextResponse.json({ error: 'Certificate PDF not found in Storage' }, { status: 404 });
    }

    const pdfBuffer = await fileData.arrayBuffer();

    // 4. Return the PDF with proper Content-Type and Content-Disposition
    const viewInline = searchParams.get('view') === 'true';
    const filename = `${cert.certificate_id || certificateId}.pdf`;
    const contentDisposition = viewInline 
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (err: any) {
    console.error('Error downloading certificate:', err);
    return NextResponse.json({ error: 'Failed to download certificate' }, { status: 500 });
  }
}
