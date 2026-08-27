import { db } from './firebase-admin';
import { getServiceSupabase } from './supabase';

export const TOTAL_INTERVIEW_QUESTIONS = 4;

export interface DbInterview {
  id: string;
  user_id: string;
  status: 'pending' | 'in_progress' | 'review_ongoing' | 'completed';
  current_question: number;
  started_at: string | null;
  completed_at: string | null;
  submitted_at: string | null;
  overall_score: number | null;
  recommendation: string | null;
  ai_review_status: string;
  email_status: string;
  created_at: string;
  updated_at: string;
}

export interface DbAnswer {
  id?: string;
  interview_id: string;
  user_id: string;
  question_number: number;
  question: string;
  transcript: string;
  video_url: string;
  duration_seconds: number;
  upload_status: string;
  transcription_status: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbAiResult {
  id?: string;
  interview_id: string;
  communication_score: number;
  confidence_score: number;
  professionalism_score: number;
  career_alignment_score: number;
  knowledge_score: number;
  motivation_score: number;
  internship_readiness_score: number;
  overall_score: number;
  recommendation: 'accepted' | 'rejected';
  strengths: string[];
  weaknesses: string[];
  summary: string;
  detailed_feedback: string;
  ai_model: string;
  processing_time: number;
  created_at?: string;
}

const tableCache: Record<string, boolean> = {};

/**
 * Checks if a Supabase table is available.
 */
async function isTableAvailable(supabase: any, tableName: string): Promise<boolean> {
  if (tableCache[tableName] === true) {
    return true;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!url || url.includes('placeholder-project') || url.includes('placeholder')) {
    tableCache[tableName] = false;
    return false;
  }

  try {
    const { error } = await supabase.from(tableName).select('id').limit(1);
    if (error) {
      // If table doesn't exist (e.g. 42P01 or PGRST116/relation does not exist), cache false
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn(`Supabase table "${tableName}" does not exist, falling back to Firestore.`);
        tableCache[tableName] = false;
        return false;
      }
      // For other errors (auth, permission, etc.), log warning but allow attempting operation
      console.warn(`Supabase table "${tableName}" check warning:`, error.message);
    }
    tableCache[tableName] = true;
    return true;
  } catch (err) {
    console.warn(`Supabase table "${tableName}" query threw exception:`, err);
    tableCache[tableName] = false;
    return false;
  }
}

/**
 * Retrieves the user's interview session.
 */
export async function getUserInterview(supabase: any, userId: string): Promise<DbInterview | null> {
  if (await isTableAvailable(supabase, 'interviews')) {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        return data as DbInterview;
      } else if (error && error.code !== '42P01') {
        console.error('Supabase getUserInterview error:', error);
      }
    } catch (err) {
      console.error('Supabase getUserInterview exception:', err);
    }
  }

  try {
    const doc = await db.collection('interviews').doc(userId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() } as DbInterview;
    }
  } catch (err) {
    console.error('Firestore getUserInterview error:', err);
  }

  return null;
}

/**
 * Initiates a new interview session.
 */
export async function createUserInterview(supabase: any, userId: string): Promise<DbInterview> {
  const startedAt = new Date().toISOString();
  const newInterview: DbInterview = {
    id: userId,
    user_id: userId,
    status: 'in_progress',
    current_question: 1,
    started_at: startedAt,
    completed_at: null,
    submitted_at: null,
    overall_score: null,
    recommendation: null,
    ai_review_status: 'pending',
    email_status: 'unscheduled',
    created_at: startedAt,
    updated_at: startedAt
  };

  if (await isTableAvailable(supabase, 'interviews')) {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .insert({
          user_id: userId,
          status: 'in_progress',
          current_question: 1,
          started_at: startedAt
        })
        .select('*')
        .single();
      
      if (!error && data) {
        return data as DbInterview;
      } else if (error) {
        console.error('Supabase createUserInterview error detail:', error);
        if (error.code !== '42P01') {
          throw new Error(`Failed to create interview in Supabase: ${error.message}`);
        }
      }
    } catch (err: any) {
      console.error('Supabase createUserInterview exception, writing to Firestore:', err);
      if (err.message && err.message.includes('Failed to create interview in Supabase')) {
        throw err;
      }
    }
  }

  // Firestore fallback
  await db.collection('interviews').doc(userId).set(newInterview);

  try {
    await db.collection('interview_status_history').add({
      interview_id: userId,
      previous_status: null,
      new_status: 'in_progress',
      changed_by: 'system',
      reason: 'Interview session initiated',
      created_at: new Date().toISOString()
    });
  } catch (hErr) {
    console.error('Failed to log history in Firestore:', hErr);
  }

  return newInterview;
}

/**
 * Retrieves the answers for an interview session.
 */
export async function getInterviewAnswers(supabase: any, userId: string, interviewId: string): Promise<DbAnswer[]> {
  if (await isTableAvailable(supabase, 'interview_answers')) {
    try {
      const { data, error } = await supabase
        .from('interview_answers')
        .select('*')
        .eq('interview_id', interviewId)
        .order('question_number', { ascending: true });
      if (!error && data) {
        return data as DbAnswer[];
      } else if (error && error.code !== '42P01') {
        console.error('Supabase getInterviewAnswers error:', error);
      }
    } catch (err) {
      console.error('Supabase getInterviewAnswers exception:', err);
    }
  }

  try {
    const snap = await db.collection('interview_answers')
      .where('user_id', '==', userId)
      .get();
    
    const answers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DbAnswer[];
    return answers.sort((a, b) => a.question_number - b.question_number);
  } catch (err) {
    console.error('Firestore getInterviewAnswers error:', err);
  }

  return [];
}

/**
 * Saves a single answer with upsert and advances current_question.
 */
export async function saveInterviewAnswer(supabase: any, userId: string, interviewId: string, answer: DbAnswer): Promise<DbAnswer> {
  const now = new Date().toISOString();
  const answerData = {
    ...answer,
    interview_id: interviewId,
    user_id: userId,
    upload_status: 'uploaded',
    created_at: now,
    updated_at: now
  };

  const adminSupabase = getServiceSupabase();

  if (await isTableAvailable(adminSupabase, 'interview_answers')) {
    try {
      const { data, error } = await adminSupabase
        .from('interview_answers')
        .upsert({
          interview_id: interviewId,
          user_id: userId,
          question_number: answer.question_number,
          question: answer.question,
          video_url: answer.video_url,
          duration_seconds: answer.duration_seconds,
          transcript: answer.transcript,
          upload_status: 'uploaded',
          transcription_status: answer.transcription_status,
          updated_at: now
        }, {
          onConflict: 'interview_id,question_number'
        })
        .select('*')
        .single();
      
      if (!error && data) {
        // Also update interview current_question safely
        const nextQuestion = Math.min(answer.question_number + 1, TOTAL_INTERVIEW_QUESTIONS);
        await adminSupabase
          .from('interviews')
          .update({
            current_question: nextQuestion,
            updated_at: now
          })
          .eq('id', interviewId);

        return data as DbAnswer;
      } else if (error) {
        console.error('Supabase saveInterviewAnswer error detail:', error);
        throw new Error(`Failed to save interview answer: ${error.message}`);
      }
    } catch (err: any) {
      console.error('Supabase saveInterviewAnswer exception:', err);
      if (err.message && err.message.includes('Failed to save interview answer')) {
        throw err;
      }
    }
  }

  // Firestore Fallback
  const docId = `${userId}_q${answer.question_number}`;
  await db.collection('interview_answers').doc(docId).set(answerData, { merge: true });

  try {
    const nextQuestion = Math.min(answer.question_number + 1, TOTAL_INTERVIEW_QUESTIONS);
    await db.collection('interviews').doc(userId).set({
      current_question: nextQuestion,
      updated_at: now
    }, { merge: true });
  } catch (err) {
    console.error('Failed to update current_question in Firestore:', err);
  }

  return answerData;
}

/**
 * Saves the AI evaluation results and transitions status to 'review_ongoing'.
 */
export async function saveEvaluationResult(supabase: any, userId: string, interviewId: string, evalResult: DbAiResult): Promise<DbAiResult> {
  const now = new Date().toISOString();
  const evalData = {
    ...evalResult,
    interview_id: interviewId,
    created_at: now
  };

  const adminSupabase = getServiceSupabase();

  if (await isTableAvailable(adminSupabase, 'interview_ai_results')) {
    try {
      const { error: aiErr } = await adminSupabase
        .from('interview_ai_results')
        .upsert({
          interview_id: interviewId,
          communication_score: evalResult.communication_score,
          confidence_score: evalResult.confidence_score,
          professionalism_score: evalResult.professionalism_score,
          career_alignment_score: evalResult.career_alignment_score,
          knowledge_score: evalResult.knowledge_score,
          motivation_score: evalResult.motivation_score,
          internship_readiness_score: evalResult.internship_readiness_score,
          overall_score: evalResult.overall_score,
          recommendation: evalResult.recommendation,
          strengths: evalResult.strengths,
          weaknesses: evalResult.weaknesses,
          summary: evalResult.summary,
          detailed_feedback: evalResult.detailed_feedback,
          ai_model: evalResult.ai_model,
          processing_time: evalResult.processing_time
        }, {
          onConflict: 'interview_id'
        });

      if (!aiErr) {
        // Update interview status to 'review_ongoing'
        const { error: interviewUpdateErr } = await adminSupabase
          .from('interviews')
          .update({
            status: 'review_ongoing',
            overall_score: evalResult.overall_score,
            recommendation: evalResult.recommendation,
            ai_review_status: 'completed',
            submitted_at: now,
            updated_at: now
          })
          .eq('id', interviewId);

        if (interviewUpdateErr) {
          console.error('Failed to update interview status after AI evaluation:', interviewUpdateErr);
          throw new Error(`Failed to update interview status: ${interviewUpdateErr.message}`);
        }

        return evalResult;
      } else {
        console.error('Supabase saveEvaluationResult error detail:', aiErr);
        throw new Error(`Failed to save AI evaluation result: ${aiErr.message}`);
      }
    } catch (err: any) {
      console.error('Supabase saveEvaluationResult exception:', err);
      if (err.message && err.message.includes('Failed to save AI evaluation')) {
        throw err;
      }
    }
  }

  // Firestore Fallback
  await db.collection('interview_ai_results').doc(userId).set(evalData);

  await db.collection('interviews').doc(userId).set({
    id: interviewId,
    user_id: userId,
    status: 'review_ongoing',
    overall_score: evalResult.overall_score,
    recommendation: evalResult.recommendation,
    ai_review_status: 'completed',
    submitted_at: now,
    updated_at: now
  }, { merge: true });

  try {
    await db.collection('interview_status_history').add({
      interview_id: userId,
      previous_status: 'in_progress',
      new_status: 'review_ongoing',
      changed_by: 'system',
      reason: 'AI evaluation successfully completed and written',
      created_at: now
    });
  } catch (hErr) {
    console.error('Failed to log history in Firestore:', hErr);
  }

  return evalData;
}

/**
 * Retrieves AI evaluation results.
 */
export async function getEvaluationResult(supabase: any, userId: string, interviewId: string): Promise<DbAiResult | null> {
  if (await isTableAvailable(supabase, 'interview_ai_results')) {
    try {
      const { data, error } = await supabase
        .from('interview_ai_results')
        .select('*')
        .eq('interview_id', interviewId)
        .maybeSingle();
      if (!error && data) {
        return data as DbAiResult;
      } else if (error && error.code !== '42P01') {
        console.error('Supabase getEvaluationResult error:', error);
      }
    } catch (err) {
      console.error('Supabase getEvaluationResult exception:', err);
    }
  }

  try {
    const doc = await db.collection('interview_ai_results').doc(userId).get();
    if (doc.exists) {
      return doc.data() as DbAiResult;
    }
  } catch (err) {
    console.error('Firestore getEvaluationResult error:', err);
  }

  return null;
}

/**
 * Completes the interview and updates applicant stage (stage 6 if accepted).
 */
export async function completeInterviewWithSimulation(
  supabase: any,
  userId: string,
  interviewId: string,
  emailSent: boolean,
  emailErrorMsg: string | null,
  aiResult: DbAiResult
): Promise<boolean> {
  const now = new Date().toISOString();
  const adminSupabase = getServiceSupabase();

  if (await isTableAvailable(adminSupabase, 'interviews')) {
    try {
      const { error: interviewErr } = await adminSupabase
        .from('interviews')
        .update({
          status: 'completed',
          email_status: emailSent ? 'sent' : 'failed',
          completed_at: now,
          updated_at: now
        })
        .eq('id', interviewId);

      if (interviewErr) {
        console.error('Supabase completeInterview error:', interviewErr);
        throw new Error(`Failed to complete interview: ${interviewErr.message}`);
      }

      // Transition applicants stage if accepted
      const isAccepted = aiResult.recommendation === 'accepted';
      if (isAccepted && await isTableAvailable(adminSupabase, 'applicants')) {
        const { data: applicant } = await adminSupabase
          .from('applicants')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (applicant) {
          const { error: applicantErr } = await adminSupabase
            .from('applicants')
            .update({
              current_stage: '6',
              competitive_edge: `Readiness Score: ${aiResult.overall_score}%\nAI Recommendation: ${aiResult.recommendation.toUpperCase()}\nStrengths: ${aiResult.strengths.join(', ')}`,
              updated_at: now
            })
            .eq('id', applicant.id);

          if (applicantErr) {
            console.error('Failed to update applicant stage 6:', applicantErr);
          }
        }
      }
      return true;
    } catch (err: any) {
      console.error('Supabase completeInterviewWithSimulation exception:', err);
      throw err;
    }
  }

  // Firestore Fallback
  await db.collection('interviews').doc(userId).set({
    id: interviewId,
    user_id: userId,
    status: 'completed',
    email_status: emailSent ? 'sent' : 'failed',
    completed_at: now,
    updated_at: now
  }, { merge: true });

  const isAccepted = aiResult.recommendation === 'accepted';
  if (isAccepted && await isTableAvailable(adminSupabase, 'applicants')) {
    try {
      const { data: applicant } = await adminSupabase
        .from('applicants')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (applicant) {
        await adminSupabase
          .from('applicants')
          .update({
            current_stage: '6',
            competitive_edge: `Readiness Score: ${aiResult.overall_score}%\nAI Recommendation: ${aiResult.recommendation.toUpperCase()}\nStrengths: ${aiResult.strengths.join(', ')}`
          })
          .eq('id', applicant.id);
      }
    } catch (applicantErr) {
      console.error('Failed to update applicants table during fallback:', applicantErr);
    }
  }

  try {
    await db.collection('interview_status_history').add({
      interview_id: userId,
      previous_status: 'review_ongoing',
      new_status: 'completed',
      changed_by: 'system',
      reason: `Simulation completed. Email dispatched: ${emailSent ? 'Success' : 'Failed'}`,
      created_at: now
    });
  } catch (hErr) {
    console.error('Failed to log history in Firestore:', hErr);
  }

  return true;
}

