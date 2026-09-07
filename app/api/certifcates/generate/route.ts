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

    // 2. Verify 100% training completion (5 modules logged)
    const { count: logsCount, error: logsErr } = await supabase
      .from('training_logs')
      .select('id', { count: 'exact', head: true })
      .eq('applicant_id', applicantId);

    if (logsErr) {
      console.error('Error fetching training logs:', logsErr);
    }

    const logsCompleted = logsCount || 0;
    const trainingCompleted = logsCompleted >= 5 || (applicant.progress_percent && applicant.progress_percent >= 100);

    if (!trainingCompleted) {
      return NextResponse.json({
        error: `Incomplete training: Student has only completed ${logsCompleted}/5 training modules. All 5 modules must be logged.`
      }, { status: 400 });
    }

    // 3. Verify final assessment has been submitted
    const { data: examSubmission, error: examErr } = await supabase
      .from('professional_exam_submissions')
      .select('*')
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (examErr) {
      console.error('Error fetching exam submission:', examErr);
    }

    if (!examSubmission) {
      return NextResponse.json({
        error: 'Assessment not submitted: Student has not submitted the final Professional Certification Exam yet.'
      }, { status: 400 });
    }

    // 4. Idempotency Check: Return existing certificate if it already exists
    const { data: existingCert, error: certErr } = await supabase
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

    // 5. Generate new unique Certificate ID and QR Code url
    const certificateId = await generateCertificateId();
    const qrVerificationUrl = `https://ecosystem.deloxehr.com/verify/${certificateId}`;
    const awardDate = new Date();

    // 6. Render the PDF Certificate using template overlay layout
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
      throw new Error(`PDF Generation failed: ${genErr.message || genErr}`);
    }

    // 7. Upload PDF certificate to storage bucket
    console.log('Uploading PDF to storage:', certificateId);
    let publicUrl: string;
    let storagePath: string;
    try {
      const uploadRes = await uploadCertificate(pdfBuffer, certificateId);
      publicUrl = uploadRes.publicUrl;
      storagePath = uploadRes.storagePath;
    } catch (upErr: any) {
      console.error('Error uploading certificate:', upErr);
      throw new Error(`Upload to storage failed: ${upErr.message || upErr}`);
    }

    // 8. Insert record into `certificates` table
    console.log('Saving certificate record to DB:', certificateId);
    const certRecord = {
      applicant_id: applicantId,
      certificate_id: certificateId,
      student_name: studentName,
      course_name: certificateConfig.courseNameDefault,
      award_date: awardDate.toISOString().split('T')[0], // YYYY-MM-DD
      issued_at: awardDate.toISOString(),
      verification_status: 'verified', // status: verified, revoked, inactive
      pdf_url: publicUrl,
      storage_path: storagePath,
      qr_verification_url: qrVerificationUrl,
    };

    const { data: newCert, error: insertCertErr } = await supabase
      .from('certificates')
      .insert(certRecord)
      .select('*')
      .single();

    if (insertCertErr) {
      console.error('Error saving certificate to DB:', insertCertErr);
      return NextResponse.json({ 
        error: 'Database error saving certificate', 
        details: insertCertErr.message,
        code: insertCertErr.code
      }, { status: 500 });
    }

    // 9. Update applicants table to store readiness_certificate_id and readiness_certificate_url
    const { error: updateAppErr } = await supabase
      .from('applicants')
      .update({
        readiness_certificate_id: certificateId,
        readiness_certificate_url: publicUrl,
      })
      .eq('id', applicantId);

    if (updateAppErr) {
      console.error('Error updating applicant with certificate info:', updateAppErr);
      // We don't fail the request since the certificate was successfully generated and stored in certificates table
    }

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