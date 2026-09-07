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

    // Query the certificates table
    const { data: cert, error } = await supabase
      .from('certificates')
      .select('pdf_url, certificate_id')
      .eq('certificate_id', certificateId)
      .maybeSingle();

    if (error || !cert || !cert.pdf_url) {
      console.error('Error finding certificate:', error);
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    // Fetch the PDF file
    const response = await fetch(cert.pdf_url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from storage: ${response.statusText}`);
    }

    const pdfBuffer = await response.arrayBuffer();

    // Return the PDF with download headers
    const viewInline = searchParams.get('view') === 'true';
    const contentDisposition = viewInline 
      ? `inline; filename="${cert.certificate_id}.pdf"`
      : `attachment; filename="${cert.certificate_id}.pdf"`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (err: any) {
    console.error('Error downloading certificate:', err);
    return NextResponse.json({ error: 'Failed to download certificate' }, { status: 500 });
  }
}