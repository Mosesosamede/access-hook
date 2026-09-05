import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateCertificateId } from '@/lib/certificate/generateCertificateId';
import { generateCertificate } from '@/lib/certificate/generateCertificate';
import { uploadCertificate } from '@/lib/certificate/uploadCertificate';
import { certificateConfig } from '@/lib/certificate/certificateconfig';

export async function POST(req: NextRequest) {
  try {
    const { applicantId } = await req.json();

    if (!applicantId) {
      return NextResponse.json({ error: 'Applicant ID is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Fetch and validate applicant
    const { data: applicant, error: appErr } = await supabase
      .from('applicants')
      .select('*')
      .eq('id', applicantId)
      .maybeSingle();

    if (appErr || !applicant) {
      console.error('Error fetching applicant:', appErr);
      return NextResponse.json({ error: 'Applicant not found' }, { status: 404 });
    }

    // 2. Verify actual exam submission & eligibility (NO fake auto-creation)
    const { data: examSubmission, error: examErr } = await supabase
      .from('professional_exam_submissions')
      .select('*')
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (examErr) {
      console.error('Error fetching exam submission:', examErr);
    }

    const isEligible = examSubmission && (examSubmission.passed === true || examSubmission.certificate_eligible === true);

    if (!isEligible) {
      return NextResponse.json({
        error: 'Assessment not submitted: Student has not passed the Professional Certification Exam yet.'
      }, { status: 400 });
    }

    // 3. Idempotency Check: Return existing certificate if it already exists
    const { data: existingCert } = await supabase
      .from('certificates')
      .select('*')
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (existingCert) {
      return NextResponse.json({
        success: true,
        certificate: existingCert,
        isNew: false
      });
    }

    // 4. Generate new unique Certificate ID and QR Code url
    const certificateId = await generateCertificateId();
    const qrVerificationUrl = `https://ecosystem.deloxehr.com/verify/${certificateId}`;
    const awardDate = new Date();

    // 5. Render the PDF Certificate using template overlay layout
    const studentName = applicant.full_name || 'Student Name';
    console.log('Generating PDF for:', studentName, certificateId);
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateCertificate({
        studentName,
        certificateId,
        awardDate,
      });
    } catch (genErr: any) {
      console.error('Error generating PDF buffer:', genErr);
      return NextResponse.json({
        error: 'PDF Generation failed',
        details: genErr.message || String(genErr)
      }, { status: 500 });
    }

    // 6. Upload PDF certificate to storage bucket & verify storage existence
    let publicUrl: string;
    let storagePath: string;
    try {
      const uploadRes = await uploadCertificate(pdfBuffer, certificateId);
      publicUrl = uploadRes.publicUrl;
      storagePath = uploadRes.storagePath;
    } catch (upErr: any) {
      console.error('Error uploading or verifying certificate in storage:', upErr);
      return NextResponse.json({
        error: 'Upload to storage failed or verification failed',
        certificateId,
        bucket: 'allcertification',
        storagePath: `certificates/${new Date().getFullYear()}/${certificateId}.pdf`,
        details: upErr.message || String(upErr)
      }, { status: 500 });
    }

    // 7. Insert record into `certificates` table ONLY AFTER successful upload & verification
    console.log('[CERTIFICATE] Database record created');
    const certRecord = {
      applicant_id: applicantId,
      certificate_id: certificateId,
      student_name: studentName,
      course_name: certificateConfig.courseNameDefault,
      award_date: awardDate.toISOString().split('T')[0], // YYYY-MM-DD
      issued_at: awardDate.toISOString(),
      verification_status: 'verified',
      pdf_url: publicUrl,
      storage_path: storagePath,
      qr_verification_url: qrVerificationUrl,
    };

    const { data: newCert, error: insertCertErr } = await supabase
      .from('certificates')
      .insert(certRecord)
      .select('*')
      .maybeSingle();

    if (insertCertErr) {
      console.error('Error saving certificate record to DB:', insertCertErr);
      return NextResponse.json({
        error: `Failed to save certificate to database: ${insertCertErr.message}`
      }, { status: 500 });
    }

    // 8. Update applicants table to store readiness_certificate_id and readiness_certificate_url
    await supabase
      .from('applicants')
      .update({
        readiness_certificate_id: certificateId,
        readiness_certificate_url: publicUrl,
      })
      .eq('id', applicantId);

    return NextResponse.json({
      success: true,
      certificate: newCert,
      isNew: true
    });

  } catch (err: any) {
    console.error('Error in certificate generation route:', err);
    return NextResponse.json({
      error: 'Failed to generate certificate',
      details: err.message || String(err)
    }, { status: 500 });
  }
}
