'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApplicant } from '@/components/ApplicantContext';
import { getSupabase } from '@/lib/supabase';
import { 
  GraduationCap, 
  Timer, 
  ChevronLeft, 
  ChevronRight, 
  Award, 
  Check, 
  AlertTriangle, 
  Loader2, 
  BookOpen, 
  CheckCircle2, 
  Sparkles, 
  Maximize2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import confetti from 'canvas-confetti';
import { CertificateCard } from '@/components/certificate/CertificateCard';
import { CertificateViewer } from '@/components/certificate/CertificateViewer';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  point: number;
  category: string;
  difficulty: string;
  quest_num?: number;
  created_at: string;
}

interface Submission {
  id: string;
  applicant_id: string;
  score: number;
  total_possible_points: number;
  percentage: number;
  passed: boolean;
  certificate_eligible: boolean;
  started_at: string;
  submitted_at: string | null;
}

interface Answer {
  id: string;
  selected_answer: string;
}

export default function ProfessionalExamPage() {
  const router = useRouter();
  const { applicant, isLoading, refreshApplicantData } = useApplicant();
  const supabase = getSupabase();

  // Load States
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, Answer>>({});
  const [loadingContent, setLoadingContent] = useState(true);

  // Certificate States
  const [certificate, setCertificate] = useState<any>(null);
  const [loadingCertificate, setLoadingCertificate] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);

  // Exam Run State
  const [isExamRunning, setIsExamRunning] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Timer State
  const [timeLeft, setTimeLeft] = useState<number>(3600); // 60 minutes in seconds
  const [timerUrgent, setTimerUrgent] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const QUESTIONS_PER_PAGE = 5;

  // Perform scoring & complete submission
  const processFinalSubmission = useCallback(async (subId: string, loadedQuestions: Question[]) => {
    try {
      setSubmitting(true);

      // 1. Fetch exact latest synchronized answers
      const { data: updatedAnswers, error: answersErr } = await supabase
        .from('professional_exam_answers')
        .select('question_id, selected_answer, is_correct')
        .eq('submission_id', subId);

      if (answersErr) {
        console.error('Error fetching updated answers:', answersErr);
      }
      
      const answersList = updatedAnswers || [];

      // 2. Calculate score
      let scoreEarned = 0;
      loadedQuestions.forEach(q => {
        const found = answersList.find(a => a.question_id === q.id);
        if (found && found.selected_answer === q.correct_answer) {
          scoreEarned += 1;
        }
      });

      const totalQs = 75;
      const percentageScore = (scoreEarned / totalQs) * 100;
      const didPass = percentageScore >= 75; // 75% benchmarks

      // Update submissions table
      const { error: subErr } = await supabase
        .from('professional_exam_submissions')
        .update({
          score: scoreEarned,
          total_possible_points: totalQs,
          percentage: parseFloat(percentageScore.toFixed(2)),
          passed: didPass,
          certificate_eligible: true, // true once exam has been taken as completed
          submitted_at: new Date().toISOString()
        })
        .eq('id', subId);

      if (subErr) throw subErr;

      // 3. Update Applicant Stage to 5 (Interview Stage)
      const { error: appErr } = await supabase
        .from('applicants')
        .update({ current_stage: '5' })
        .eq('id', applicant?.id);

      if (appErr) throw appErr;

      // Unset active exam
      setIsExamRunning(false);
      setShowSubmitConfirm(false);
      
      // Refresh global applicant context data so progression and UI unlocks automatically
      await refreshApplicantData();

      // confetti!
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });

      // Reload latest submission
      const { data: updatedSub, error: updateErr } = await supabase
        .from('professional_exam_submissions')
        .select('*')
        .eq('id', subId)
        .maybeSingle();

      if (updateErr) {
        console.error('Error fetching updated submission:', updateErr);
      }

      if (updatedSub) {
        setSubmission(updatedSub);
      }
    } catch (err) {
      console.error('Submission processing failed:', err);
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant?.id, refreshApplicantData]);

  // Auto Submit when Timer hits 0
  const handleAutoSubmit = useCallback((subId: string, loadedQuestions: Question[]) => {
    processFinalSubmission(subId, loadedQuestions);
  }, [processFinalSubmission]);

  // Manual Trigger Submit
  const handleManualSubmit = () => {
    if (!submission) return;
    processFinalSubmission(submission.id, questions);
  };

  // Certificate Auto-Generation & Loading Hook
  useEffect(() => {
    if (!applicant || !submission || !submission.submitted_at) return;

    const autoGenerateAndLoadCertificate = async () => {
      try {
        setLoadingCertificate(true);
        setCertificateError(null);
        const res = await fetch('/api/certificates/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicantId: applicant.id }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setCertificate(data.certificate);
        } else {
          setCertificateError(data.error || 'Failed to generate certificate');
        }
      } catch (err) {
        console.error('Error generating certificate:', err);
        setCertificateError('Failed to generate certificate');
      } finally {
        setLoadingCertificate(false);
      }
    };

    autoGenerateAndLoadCertificate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant?.id, submission?.submitted_at]);

  // 1. Initial Load: Questions and Submissions
  useEffect(() => {
    if (isLoading || !applicant) return;

    const loadExamData = async () => {
      try {
        setLoadingContent(true);

        // Fetch all questions ordered by quest_num 1 to 75
        const { data: qData, error: qErr } = await supabase
          .from('professional_exam_questions')
          .select('*')
          .order('quest_num', { ascending: true });

        if (qErr) throw qErr;

        if (qData) {
          const sorted = [...qData].sort((a, b) => (a.quest_num || 0) - (b.quest_num || 0));
          setQuestions(sorted);
        }

        // Fetch user submission
        const { data: sData, error: sErr } = await supabase
          .from('professional_exam_submissions')
          .select('*')
          .eq('applicant_id', applicant.id)
          .maybeSingle();

        if (sErr) throw sErr;

        if (sData) {
          setSubmission(sData);

          // If submission is active (not submitted yet), restore answers and timer
          if (!sData.submitted_at) {
            setIsExamRunning(true);
            
            // Load saved answers
            const { data: aData } = await supabase
              .from('professional_exam_answers')
              .select('id, question_id, selected_answer')
              .eq('submission_id', sData.id);

            if (aData) {
              const ansMap: Record<string, Answer> = {};
              aData.forEach(ans => {
                ansMap[ans.question_id] = {
                  id: ans.id,
                  selected_answer: ans.selected_answer
                };
              });
              setSavedAnswers(ansMap);
            }

            // Sync countdown
            const elapsed = Math.floor((Date.now() - new Date(sData.started_at).getTime()) / 1000);
            const totalDuration = 60 * 60; // 60 mins = 3600s
            const remaining = Math.max(0, totalDuration - elapsed);
            setTimeLeft(remaining);

            if (remaining <= 0) {
              // Time expired, auto-submit
              handleAutoSubmit(sData.id, qData || []);
            }
          }
        }
      } catch (err) {
        console.error('Error loading exam data:', err);
      } finally {
        setLoadingContent(false);
      }
    };

    loadExamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant, isLoading]);

  // 2. Timer Countdown logic
  useEffect(() => {
    if (isExamRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const nextVal = prev - 1;
          if (nextVal <= 300) { // 5 minutes remaining
            setTimerUrgent(true);
          }
          if (nextVal <= 0) {
            clearInterval(timerRef.current!);
            if (submission) {
              handleAutoSubmit(submission.id, questions);
            }
            return 0;
          }
          return nextVal;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExamRunning, timeLeft, submission, questions]);

  // Loading wrapper
  if (isLoading || loadingContent) {
    return (
      <div className="min-h-screen bg-[#1a2321] flex flex-col items-center justify-center p-4">
        <Loader2 size={48} className="animate-spin text-[#DFFF00] mb-4" />
        <p className="text-gray-400 text-sm font-medium">Loading professional certification assessments...</p>
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="min-h-screen bg-[#1a2321] flex flex-col items-center justify-center p-4">
        <div className="bg-[#26312f] p-8 rounded-3xl border border-white/10 text-center max-w-md shadow-xl">
          <AlertTriangle className="text-red-400 w-12 h-12 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">Applicant details could not be detected. Please try logging in again.</p>
          <button onClick={() => router.push('/login')} className="px-6 py-2.5 bg-[#DFFF00] text-[#1a2321] font-bold rounded-xl hover:brightness-110">Go to Login</button>
        </div>
      </div>
    );
  }

  // Security Check: Lock if they are in stage less than 4 (modules not done)
  const isUnlocked = (parseInt(applicant.current_stage) || 1) >= 4;

  if (!isUnlocked) {
    return (
      <DashboardLayout>
        <div className="bg-[#26312f] p-8 md:p-12 rounded-3xl border border-white/10 text-center max-w-2xl mx-auto my-12 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
            <AlertTriangle className="text-gray-400 w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-white">Professional Exam Is Locked</h2>
          <p className="text-gray-300 leading-relaxed max-w-md mx-auto">
            You must complete all <strong>Training Hub Modules and Quizzes (100% progress)</strong> to unlock the Professional Certification Exam.
          </p>
          <div className="pt-4">
            <button 
              onClick={() => router.push('/dashboard/training-hub')} 
              className="px-8 py-3.5 bg-[#DFFF00] text-[#1a2321] font-black text-base rounded-xl hover:brightness-110 transition-all flex items-center gap-2 mx-auto"
            >
              <BookOpen size={18} /> Resume Modules & Quizzes
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // A helper to initialize the exam attempt in Supabase
  const handleStartExam = async () => {
    try {
      setLoadingContent(true);

      const newSubmission = {
        applicant_id: applicant.id,
        score: 0,
        total_possible_points: 75,
        percentage: 0,
        passed: false,
        certificate_eligible: false,
        started_at: new Date().toISOString(),
        submitted_at: null
      };

      const { data: sData, error: sErr } = await supabase
        .from('professional_exam_submissions')
        .insert(newSubmission)
        .select('*')
        .single();

      if (sErr) throw sErr;

      setSubmission(sData);
      setSavedAnswers({});
      setIsExamRunning(true);
      setTimeLeft(3600); // 60 minutes
    } catch (err) {
      console.error('Error starting exam:', err);
    } finally {
      setLoadingContent(false);
    }
  };

  // Safe Upsert Answer logic
  const handleAnswerSelect = async (questionId: string, choiceText: string, category: string) => {
    if (!submission) return;

    setSavingAnswerId(questionId);

    try {
      const matchQuestion = questions.find(q => q.id === questionId);
      const isCorrect = matchQuestion ? matchQuestion.correct_answer === choiceText : false;
      const points = isCorrect ? 1 : 0;

      const existingRecord = savedAnswers[questionId];

      if (existingRecord) {
        // UPDATE existing
        const { error: upErr } = await supabase
          .from('professional_exam_answers')
          .update({
            selected_answer: choiceText,
            is_correct: isCorrect,
            points_earned: points,
            category: category
          })
          .eq('id', existingRecord.id);

        if (upErr) throw upErr;

        setSavedAnswers(prev => ({
          ...prev,
          [questionId]: {
            ...prev[questionId],
            selected_answer: choiceText
          }
        }));
      } else {
        // INSERT new
        const newAns = {
          submission_id: submission.id,
          applicant_id: applicant.id,
          question_id: questionId,
          selected_answer: choiceText,
          is_correct: isCorrect,
          points_earned: points,
          category: category
        };

        const { data: insData, error: insErr } = await supabase
          .from('professional_exam_answers')
          .insert(newAns)
          .select('id')
          .single();

        if (insErr) throw insErr;

        setSavedAnswers(prev => ({
          ...prev,
          [questionId]: {
            id: insData.id,
            selected_answer: choiceText
          }
        }));
      }
    } catch (err) {
      console.error('Error saving answer:', err);
    } finally {
      setSavingAnswerId(null);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // PAGINATION calculations
  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const currentQuestionsBatch = questions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage * QUESTIONS_PER_PAGE) + QUESTIONS_PER_PAGE
  );

  const answeredCount = Object.keys(savedAnswers).length;

  // -- MAIN VIEW SWITCHER --

  // VIEW 1: RESULTS VIEW (Exam Taken, Complete)
  const isSubmitted = submission && submission.submitted_at;
  if (isSubmitted) {
    const dateSubmitted = submission ? new Date(submission.submitted_at!).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '';

    return (
      <DashboardLayout>
        <div className="space-y-8 max-w-4xl mx-auto py-6" id="exam-results-view">
          {/* Main Success Badge Card */}
          <div className="bg-[#26312f] border border-white/10 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full"></div>
            
            <div className="w-24 h-24 bg-[#DFFF00]/10 border border-[#DFFF00]/20 text-[#DFFF00] rounded-full flex items-center justify-center mx-auto mb-6">
              <Award className="w-12 h-12 filter drop-shadow-[0_0_12px_rgba(223,255,0,0.5)]" />
            </div>

            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2">Certification Assessment Complete</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Submitted on {dateSubmitted}
            </p>

            {/* Score Grid details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mt-10">
              <div className="bg-[#1c2624] border border-white/5 p-6 rounded-2xl">
                <span className="text-xs text-gray-400 block mb-1 uppercase tracking-wider">Your Score</span>
                <span className="text-3xl font-black text-white">{submission.score} <span className="text-sm text-gray-500 font-normal">/ {submission.total_possible_points}</span></span>
              </div>
              
              <div className="bg-[#1c2624] border border-white/5 p-6 rounded-2xl">
                <span className="text-xs text-gray-400 block mb-1 uppercase tracking-wider">Grade Percentage</span>
                <span className="text-3xl font-black text-[#DFFF00]">{submission.percentage}%</span>
              </div>

              <div className="bg-[#1c2624] border border-white/5 p-6 rounded-2xl">
                <span className="text-xs text-gray-400 block mb-1 uppercase tracking-wider">Certification Status</span>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-lg font-black text-green-400 uppercase tracking-wide">ELIGIBLE</span>
                </div>
              </div>
            </div>

            {/* Stage Milestone Notification */}
            <div className="bg-[#1d2725] border border-green-500/20 p-6 rounded-2xl max-w-2xl mx-auto mt-8 flex flex-col md:flex-row items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center flex-shrink-0 text-green-400">
                <CheckCircle2 />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Interview Stage Officially Unlocked!</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Congratulations! Because you submitted your Professional Certification Exam, you have fulfilled all Phase 1 training criteria. Your profile has advanced to <strong>Stage 5 (Interview Phase)</strong>. HR coordinators will review your responses as part of your assessment package.
                </p>
              </div>
            </div>

            {/* Certificate Section */}
            <div className="max-w-2xl mx-auto mt-8 text-left space-y-6">
              <div className="border-t border-white/5 pt-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="text-[#dbf0de] w-5 h-5" /> Your Professional Certificate
                </h3>
              </div>
              {loadingCertificate ? (
                <div className="bg-[#1c2624] border border-white/5 rounded-3xl p-8 text-center flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#DFFF00] animate-spin" />
                  <p className="text-xs text-gray-400">Preparing secure PDF certificate...</p>
                </div>
              ) : certificateError ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400">
                  Failed to load certificate: {certificateError}
                </div>
              ) : certificate ? (
                <div className="space-y-6">
                  <CertificateCard
                    certificateId={certificate.certificate_id}
                    studentName={certificate.student_name}
                    courseName={certificate.course_name}
                    awardDate={certificate.award_date}
                    pdfUrl={certificate.pdf_url}
                  />
                  <CertificateViewer
                    pdfUrl={certificate.pdf_url}
                    certificateId={certificate.certificate_id}
                    studentName={certificate.student_name}
                    awardDate={certificate.award_date}
                    courseName={certificate.course_name}
                  />
                </div>
              ) : null}
            </div>

            {/* Return Hub Button */}
            <div className="pt-10">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-10 py-4 bg-[#DFFF00] text-[#1a2321] rounded-xl font-black text-base hover:brightness-110 shadow-[0_0_20px_rgba(223,255,0,0.3)] transition-all inline-flex items-center gap-2"
              >
                Go to Dashboard Hub
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // VIEW 2: ACTIVE RUNNING EXAM (Distraction-Free Fullscreen View)
  if (isExamRunning) {
    return (
      <div className="min-h-screen bg-[#0f1413] text-[#E0E6ED] flex flex-col relative" id="distraction-free-exam-container">
        
        {/* TOP COMPACT NAVIGATION & TIMING BAR */}
        <header className="sticky top-0 z-50 bg-[#161e1c] border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-[#DFFF00] text-[#1a2321] px-3 py-1 text-xs font-black rounded-lg uppercase tracking-wider">
              Live Assessment
            </span>
            <span className="text-xs text-gray-400 hidden sm:inline-block font-mono">
              Applicant Registry: {applicant.email}
            </span>
          </div>

          {/* TIMER CONTAINER */}
          <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border transition-all ${
            timerUrgent 
              ? 'bg-red-500/10 border-red-500 text-red-400 animate-pulse' 
              : 'bg-[#1e2826] border-white/15 text-[#DFFF00]'
          }`}>
            <Timer className="w-5 h-5" />
            <span className="font-mono text-base font-bold tracking-widest">{formatTime(timeLeft)}</span>
          </div>

          <div>
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={submitting}
              className="px-6 py-2 bg-gradient-to-r from-[#DFFF00] to-green-400 text-[#1a2321] text-xs font-black uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40"
            >
              Finish & Submit
            </button>
          </div>
        </header>

        {/* OVERALL FLOATING PROGRESS BAR */}
        <div className="w-full bg-[#1c2624] h-1.5 overflow-hidden">
          <div 
            className="bg-[#DFFF00] h-full transition-all duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          ></div>
        </div>

        {/* MAIN BODY AREA */}
        <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 space-y-8 pb-32">
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <GraduationCap className="text-[#DFFF00] w-6 h-6" />
                Professional Certification Exam
              </h2>
              <p className="text-xs text-gray-400 mt-1">Please answer every query on the page. Progression autosaves to cloud instantly on select.</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-xs font-mono text-[#DFFF00] bg-[#DFFF00]/10 px-3 py-1.5 rounded-full font-bold">
                Page {currentPage + 1} of {totalPages}
              </span>
            </div>
          </div>

          {/* LIST OF QUESTIONS (5 per page) */}
          <div className="space-y-6">
            {currentQuestionsBatch.map((q, idx) => {
              const overallIndex = q.quest_num ?? ((currentPage * QUESTIONS_PER_PAGE) + idx + 1);
              const savedUserChoice = savedAnswers[q.id]?.selected_answer;
              const isSaving = savingAnswerId === q.id;

              return (
                <div 
                  key={q.id} 
                  id={`q-element-${q.id}`}
                  className={`bg-[#161e1c] border rounded-2xl p-6 transition-all duration-200 ${
                    savedUserChoice 
                      ? 'border-green-500/20 shadow-[0_4px_20px_rgba(34,197,94,0.02)]' 
                      : 'border-white/5'
                  }`}
                >
                  {/* Category + Index */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-md">
                      {q.category}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-xs text-gray-400">
                      <span>Q.{overallIndex}</span>
                      {isSaving && <Loader2 className="w-3.5 h-3.5 text-[#DFFF00] animate-spin" />}
                      {!isSaving && savedUserChoice && <span className="text-green-400 text-[10px] font-bold">● SAVED</span>}
                    </div>
                  </div>

                  {/* Question Text */}
                  <h3 className="text-base text-white font-medium leading-relaxed mb-4">
                    {q.question_text}
                  </h3>

                  {/* Options List */}
                  <div className="grid grid-cols-1 gap-2.5">
                    {q.options.map((optionText, oIdx) => {
                      const isSelected = savedUserChoice === optionText;
                      return (
                        <button
                          key={oIdx}
                          disabled={submitting}
                          onClick={() => handleAnswerSelect(q.id, optionText, q.category)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs flex items-center justify-between ${
                            isSelected 
                              ? 'border-[#DFFF00] bg-[#DFFF00]/5 text-[#DFFF00] shadow-[0_0_12px_rgba(223,255,0,0.05)]' 
                              : 'border-white/5 bg-white/[0.02] text-[#E0E6ED] hover:border-white/10 hover:bg-white/[0.04]'
                          }`}
                        >
                          <span className="leading-relaxed">{optionText}</span>
                          <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'border-[#DFFF00] bg-[#DFFF00]' 
                              : 'border-white/20'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-[#1a2321] stroke-[3px]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* PAGE CONTROL FOOTER */}
          <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-10">
            <button
              onClick={() => {
                if (currentPage > 0) {
                  setCurrentPage(prev => prev - 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              disabled={currentPage === 0}
              className="px-5 py-3 rounded-xl border border-white/10 text-white font-semibold flex items-center gap-1.5 hover:bg-white/5 disabled:opacity-40 transition"
            >
              <ChevronLeft size={18} /> Prev Page
            </button>

            <span className="text-xs text-gray-400">
              Showing {currentPage * QUESTIONS_PER_PAGE + 1} - {Math.min((currentPage * QUESTIONS_PER_PAGE) + QUESTIONS_PER_PAGE, questions.length)} of {questions.length} Questions
            </span>

            {currentPage < totalPages - 1 ? (
              <button
                onClick={() => {
                  setCurrentPage(prev => prev + 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-5 py-3 rounded-xl bg-[#DFFF00] text-[#1a2321] font-bold flex items-center gap-1.5 hover:brightness-110 transition"
              >
                Next Page <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-400 to-[#DFFF00] text-[#1a2321] font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition"
              >
                Review & Submit!
              </button>
            )}
          </div>
        </main>

        {/* PERSISTENT FLOOR PANEL: QUESTION TRACKER GRID */}
        <footer className="fixed bottom-0 inset-x-0 bg-[#161e1c]/95 backdrop-blur-md border-t border-white/10 p-4 z-40 hidden md:block">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-400">ANSWER MONITOR</span>
              <span className="font-mono text-[#DFFF00] font-bold">
                {answeredCount} of {questions.length} Complete
              </span>
            </div>
            
            {/* 75 Circles tracker */}
            <div className="flex flex-wrap gap-1.5 justify-start">
              {questions.map((q, idx) => {
                const pageNumber = Math.floor(idx / QUESTIONS_PER_PAGE);
                const isAnswered = !!savedAnswers[q.id];
                const isCurrentPage = pageNumber === currentPage;
                const displayNum = q.quest_num ?? (idx + 1);

                return (
                  <button
                    key={q.id}
                    title={`Question ${displayNum}`}
                    onClick={() => {
                      setCurrentPage(pageNumber);
                      setTimeout(() => {
                        const elem = document.getElementById(`q-element-${q.id}`);
                        if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }}
                    className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-black transition-all ${
                      isCurrentPage 
                        ? 'ring-2 ring-[#DFFF00] ring-offset-2 ring-offset-[#0f1413]' 
                        : ''
                    } ${
                      isAnswered 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-white/[0.04] text-gray-500 border border-white/5'
                    }`}
                  >
                    {displayNum}
                  </button>
                );
              })}
            </div>
          </div>
        </footer>

        {/* SUBMIT CONFIRMATION MODAL */}
        <AnimatePresence>
          {showSubmitConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#010303]/85 backdrop-blur-md p-4">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.95, opacity: 0 }} 
                className="bg-[#1c2624] border border-white/10 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl"
              >
                <div className="w-16 h-16 bg-[#DFFF00]/10 border border-[#DFFF00]/20 text-[#DFFF00] rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white">Submit Certification?</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    You have answered <strong>{answeredCount} of {questions.length}</strong> questions. Once submitted, your answers are locked for assessment and you cannot review or modify them.
                  </p>
                </div>

                {answeredCount < questions.length && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-left flex gap-3 text-red-400">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-xs leading-relaxed font-semibold">
                      Notice: You still have {questions.length - answeredCount} unanswered questions! We suggest answering all questions for maximum scoring capability.
                    </span>
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    disabled={submitting}
                    className="flex-1 px-5 py-3.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded-xl border border-white/5 transition"
                  >
                    Keep Answering
                  </button>
                  <button
                    onClick={handleManualSubmit}
                    disabled={submitting}
                    className="flex-1 px-5 py-3.5 bg-[#DFFF00] text-[#1a2321] font-black rounded-xl hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1.5"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Yes, Submit'
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    );
  }

  // VIEW 3: PRE-EXAM ONBOARDING VIEW
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8 py-6" id="exam-onboarding-view">
        
        {/* Banner Card */}
        <div className="bg-gradient-to-br from-[#26312f] to-[#1c2624] border border-white/10 rounded-3xl p-8 md:p-12 shadow-xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#DFFF00]/5 blur-3xl rounded-full"></div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-[#DFFF00]/10 border border-[#DFFF00]/20 text-[#DFFF00] px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
              <GraduationCap className="w-4 h-4" /> Unlocked Phase 2 Milestone
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">
              Deloxe HR <br />
              Professional Certification Exam
            </h1>
            
            <p className="text-base text-gray-300 leading-relaxed max-w-xl">
              You have completed all 5 training modules. You are now authorized to sit for the final Professional Certification Exam.
            </p>
          </div>

          {/* Exam Rules details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10 border-t border-white/10 pt-8 text-sm">
            <div className="space-y-3">
              <h3 className="text-white font-bold uppercase tracking-wider text-xs">Aassessment Guideline:</h3>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#DFFF00] mt-0.5 flex-shrink-0" />
                  <span>The complete assessment contains exactly <strong>75 questions</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#DFFF00] mt-0.5 flex-shrink-0" />
                  <span>Configured index pagination shows 5 questions per page.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#DFFF00] mt-0.5 flex-shrink-0" />
                  <span>Answers auto-save and sync to local databases instantly on select.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-bold uppercase tracking-wider text-xs">Exams Policy:</h3>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#DFFF00] mt-0.5 flex-shrink-0" />
                  <span>You have exactly <strong>60 minutes (1h)</strong> to complete.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#DFFF00] mt-0.5 flex-shrink-0" />
                  <span>The timer persists and continues to tick even on refresh or exit.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#DFFF00] mt-0.5 flex-shrink-0" />
                  <span>Only one attempt is permitted. Exam locks permanently once submitted.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Launch Controls */}
          <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="text-left">
              <span className="text-xs text-gray-500 block">Assessment Target:</span>
              <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Professional Certification Score
              </span>
            </div>
            <button
              onClick={handleStartExam}
              className="w-full sm:w-auto px-10 py-4 bg-[#DFFF00] text-[#1a2321] rounded-xl font-black text-lg hover:brightness-110 shadow-[0_0_24px_rgba(223,255,0,0.35)] transition-all flex items-center justify-center gap-2"
            >
              Start Certification Exam <Maximize2 size={18} />
            </button>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
