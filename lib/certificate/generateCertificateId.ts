import { getServiceSupabase } from '@/lib/supabase';

/**
 * Generates a unique Certificate ID like DELX-2026-000001
 */
export async function generateCertificateId(): Promise<string> {
  const supabase = getServiceSupabase();
  const currentYear = new Date().getFullYear();
  const yearStr = currentYear.toString();

  try {
    // Count certificates starting with DELX-YEAR-
    const { count, error } = await supabase
      .from('certificates')
      .select('certificate_id', { count: 'exact', head: true })
      .like('certificate_id', `DELX-${yearStr}-%`);

    if (error) {
      console.error('Error counting certificates:', error);
    }

    const currentCount = count || 0;
    
    // We increment count and pad with 5 zeros
    let sequentialNum = currentCount + 1;
    let certId = `DELX-${yearStr}-${String(sequentialNum).padStart(5, '0')}`;

    // Double check if this certId already exists in database (safety check)
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const { data, error: checkError } = await supabase
        .from('certificates')
        .select('certificate_id')
        .eq('certificate_id', certId)
        .maybeSingle();

      if (!checkError && !data) {
        isUnique = true;
      } else {
        sequentialNum++;
        certId = `DELX-${yearStr}-${String(sequentialNum).padStart(5, '0')}`;
        attempts++;
      }
    }

    return certId;
  } catch (err) {
    console.error('Failed to generate Certificate ID:', err);
    // Fallback: use random suffix with 5 digits if db call fails
    const randomSuffix = String(Math.floor(1000 + Math.random() * 9000)).padStart(5, '0');
    return `DELX-${yearStr}-${randomSuffix}`;
  }
}
