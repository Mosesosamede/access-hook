import { getServiceSupabase } from '@/lib/supabase';

/**
 * Uploads a generated certificate PDF to the Supabase Storage bucket `allcertification`.
 * Folder structure: certificates/{year}/{certificateId}.pdf
 * 
 * @param fileBuffer Binary buffer of the PDF file.
 * @param certificateId Unique Certificate ID.
 * @returns Object with the public URL and storage path.
 */
export async function uploadCertificate(
  fileBuffer: ArrayBuffer | Buffer,
  certificateId: string
): Promise<{ publicUrl: string; storagePath: string }> {
  const supabase = getServiceSupabase();
  const bucketName = 'allcertification';
  const currentYear = new Date().getFullYear();
  const storagePath = `certificates/${currentYear}/${certificateId}.pdf`;

  console.log(`[CERTIFICATE] ID: ${certificateId}`);
  console.log(`[CERTIFICATE] Bucket: ${bucketName}`);
  console.log(`[CERTIFICATE] Storage path: ${storagePath}`);

  try {
    // 1. Upload the file to allcertification storage bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error(`[CERTIFICATE] Upload error for ${certificateId}:`, uploadError);
      throw new Error(`Failed to upload certificate PDF to storage bucket '${bucketName}': ${uploadError.message}`);
    }

    console.log('[CERTIFICATE] Upload successful');

    // 2. Verify that the uploaded file actually exists in Storage
    const { data: verifyData, error: verifyError } = await supabase.storage
      .from(bucketName)
      .download(storagePath);

    if (verifyError || !verifyData) {
      console.error(`[CERTIFICATE] Storage verification failed for ${storagePath}:`, verifyError);
      throw new Error(`Storage verification failed for path '${storagePath}': ${verifyError?.message || 'File not found'}`);
    }

    console.log('[CERTIFICATE] Storage verification successful');

    // 3. Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    return {
      publicUrl,
      storagePath: uploadData?.path || storagePath,
    };
  } catch (err: any) {
    console.error('Failed to upload and verify certificate in Supabase Storage:', err);
    throw err;
  }
}
