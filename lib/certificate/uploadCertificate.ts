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

  try {
    // 1. Ensure the bucket exists (try to create if it doesn't, ignoring errors)
    const { data: buckets } = await supabase.storage.listBuckets();
    const hasBucket = buckets?.some(b => b.name === bucketName);
    
    if (!hasBucket) {
      console.log(`Bucket ${bucketName} not found, attempting to create it...`);
      await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/pdf', 'image/png']
      });
    }

    // 2. Upload the file
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // 3. Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    return {
      publicUrl,
      storagePath,
    };
  } catch (err: any) {
    console.error('Failed to upload certificate to Supabase Storage:', err);
    throw new Error(`Upload failed: ${err.message || err}`);
  }
}
