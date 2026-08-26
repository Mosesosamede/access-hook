'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getSupabase } from '@/lib/supabase';
import { useApplicant } from '@/components/ApplicantContext';
import { 
  Video, Mic, MicOff, VideoOff, Play, Square, RefreshCw, Send, CheckCircle, 
  ChevronRight, AlertCircle, Award, ShieldAlert, Check, HelpCircle, 
  Loader2, ArrowRight, BookOpen, ExternalLink, Mail, Clock, Heart, ArrowLeft, RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Answer {
  question_number: number;
  question: string;
  video_url: string;
  transcript: string;
  duration_seconds: number;
}

const QUESTIONS = [
  {
    number: 1,
    title: "Industry & Career Goals",
    text: "Which specific industry or type of company is your dream match for this internship, and how will landing there help you reach your big career goals?"
  },
  {
    number: 2,
    title: "Training & Knowledge Transfer",
    text: "Think about the training you've received so far. What is the most valuable thing you learned, and exactly how do you plan to use that knowledge to add value to the company you get placed in?"
  },
  {
    number: 3,
    title: "Program Expectations & ROI",
    text: "At the end of this internship program, what does success look like for you? What is the main thing you want to walk away with, and what mark do you want to leave behind?"
  }
];

export default function AIInterviewPage() {
  const router = useRouter();
  const { applicant, user, refreshApplicantData } = useApplicant();

  // Interview state from DB
  const [interview, setInterview] = useState<any>(null);
  const [completedAnswers, setCompletedAnswers] = useState<Answer[]>([]);
  const [aiResult, setAiResult] = useState<any>(null);
  const [loadingState, setLoadingState] = useState(true);

  // Flow & Step State
  const [permissionsGranted, setPermissionsGranted] = useState<boolean | null>(null);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // References (Standard WebMedia API elements)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const recordedReplayRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 2. Camera & Mic Permission Handling
  const checkDevicePermissions = async (request = false) => {
    setCheckingPermissions(true);
    try {
      if (request) {
        await startCameraPreview();
      } else {
        // Query permissions via Permissions API if available
        const videoPerm = await navigator.permissions.query({ name: 'camera' as any }).catch(() => null);
        const audioPerm = await navigator.permissions.query({ name: 'microphone' as any }).catch(() => null);

        if (videoPerm?.state === 'granted' && audioPerm?.state === 'granted') {
          setPermissionsGranted(true);
        } else if (videoPerm?.state === 'denied' || audioPerm?.state === 'denied') {
          setPermissionsGranted(false);
        } else {
          setPermissionsGranted(null);
        }
      }
    } catch (err) {
      console.error("Camera/Mic permission check failed:", err);
      setPermissionsGranted(false);
    } finally {
      setCheckingPermissions(false);
    }
  };

  const loadFallbackInterview = () => {
    setIsFallbackMode(true);
    const localInt = localStorage.getItem('deloxe_sandbox_interview');
    const localAns = localStorage.getItem('deloxe_sandbox_answers');
    const localEval = localStorage.getItem('deloxe_sandbox_eval');

    if (localInt) {
      setInterview(JSON.parse(localInt));
      setCompletedAnswers(localAns ? JSON.parse(localAns) : []);
      setAiResult(localEval ? JSON.parse(localEval) : null);
      
      const parsedAns = localAns ? JSON.parse(localAns) : [];
      const nextIdx = parsedAns.length;
      setCurrentQuestionIdx(nextIdx < 3 ? nextIdx : 2);
    } else {
      setInterview(null);
      setCompletedAnswers([]);
      setAiResult(null);
    }
  };

  const fetchInterviewStatus = async () => {
    try {
      setLoadingState(true);
      const res = await fetch('/api/interview/status');
      
      if (!res.ok) {
        // If status API failed, fall back gracefully
        console.warn("Interview status not found or DB error.");
        return;
      }

      const data = await res.json();
      if (data.exists) {
        setInterview(data.interview);
        setCompletedAnswers(data.answers || []);
        setAiResult(data.aiResult);

        // Resume from the next unanswered question
        const nextIdx = (data.answers || []).length;
        setCurrentQuestionIdx(nextIdx < 3 ? nextIdx : 2);
      } else {
        setInterview(null);
        setCompletedAnswers([]);
        setAiResult(null);
      }
    } catch (err) {
      console.error("Failed to load interview.", err);
    } finally {
      setLoadingState(false);
      checkDevicePermissions(false); // Check silently
    }
  };

  // 1. Fetch / initialize interview status on mount
  useEffect(() => {
    const deferTimer = setTimeout(() => {
      fetchInterviewStatus();
    }, 0);
    return () => clearTimeout(deferTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant]);

  // 3. Initiate Stream preview inside video element
  const startCameraPreview = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true
      });

      mediaStreamRef.current = stream;
      setPermissionsGranted(true);
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true; // Avoid feedback loop
        videoPreviewRef.current.play().catch(e => console.error(e));
      }
    } catch (err) {
      console.error("Failed to start camera stream:", err);
      setPermissionsGranted(false);
    }
  };

  // Clean up streaming on unmount or question transition
  const stopCameraPreview = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  // Trigger camera preview whenever entering a recording state
  useEffect(() => {
    if (permissionsGranted !== false && !recordedUrl && !isUploading && !loadingState && interview && interview.status === 'in_progress') {
      startCameraPreview();
    }
    return () => {
      stopCameraPreview();
    };
  }, [permissionsGranted, recordedUrl, currentQuestionIdx, interview, isUploading, loadingState]);

  // Navigation Protection alert
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        e.preventDefault();
        e.returnValue = 'You have an active recording in progress. Leaving will discard unsaved answers.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRecording]);

  // 4. Start Recording Logic
  const startRecording = () => {
    if (!mediaStreamRef.current) return;
    
    chunksRef.current = [];
    setRecordedChunks([]);
    setRecordedUrl(null);
    setRecordingDuration(0);
    setIsRecording(true);

    const recorder = new MediaRecorder(mediaStreamRef.current, {
      mimeType: 'video/webm;codecs=vp8,opus'
    });

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        setRecordedChunks(prev => [...prev, e.data]);
      }
    };

    recorder.onstop = () => {
      setIsRecording(false);
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
    };

    recorder.start(1000); // chunk every second

    // Start timer countdown (120 seconds max)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= 119) {
          // Trigger Auto stop when 2 minutes are reached
          stopRecording();
          return 120;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // 5. Stop Recording Logic
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    stopCameraPreview();
  };

  // Re-record
  const handleRerecord = () => {
    chunksRef.current = [];
    setRecordedChunks([]);
    setRecordedUrl(null);
    setRecordingDuration(0);
    startCameraPreview();
  };

  // 6. Submit Answer (Upload video + transcribe + save)
  const handleSubmitAnswer = async () => {
    if (recordedChunks.length === 0 || !interview) return;

    setIsUploading(true);
    setUploadProgress(10);

    const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
    const currentQuestion = QUESTIONS[currentQuestionIdx];

    try {
      let videoUrl = '';
      const supabase = getSupabase();

      // Retrieve current authenticated Supabase user ID to strictly satisfy auth.uid() folder RLS policy
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let authenticatedUserId = authUser?.id || user?.id || applicant?.user_id;

      if (!authenticatedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        authenticatedUserId = session?.user?.id;
      }

      if (!authenticatedUserId) {
        throw new Error('Authentication session required to upload interview video. Please log in again.');
      }

      // Storage folder MUST equal auth.uid() for RLS check
      const filename = `${authenticatedUserId}/${interview.id}_q${currentQuestion.number}.webm`;

      setUploadProgress(30);

      // Attempt Supabase Storage upload respecting the auth.uid() folder RLS policy
      try {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('interview-videos')
          .upload(filename, videoBlob, {
            cacheControl: '3600',
            upsert: true
          });

        if (!uploadErr && uploadData?.path) {
          const { data: { publicUrl } } = supabase.storage
            .from('interview-videos')
            .getPublicUrl(filename);
          videoUrl = publicUrl || `/api/interview/video?path=${encodeURIComponent(filename)}`;
        } else {
          console.warn('Supabase Storage upload warning (proceeding with direct API transcription):', uploadErr?.message);
          videoUrl = `/api/interview/video?path=${encodeURIComponent(filename)}`;
        }
      } catch (storageException: any) {
        console.warn('Storage upload skipped/exception:', storageException?.message);
        videoUrl = `/api/interview/video?path=${encodeURIComponent(filename)}`;
      }

        // Call Server API to transcribe & save
        const formData = new FormData();
        formData.append('audio', videoBlob, 'audio.webm'); // Groq Whisper accepts webm
        formData.append('questionNumber', currentQuestion.number.toString());
        formData.append('questionText', currentQuestion.text);
        formData.append('videoUrl', videoUrl);
        formData.append('duration', recordingDuration.toString());
        formData.append('interviewId', interview.id);

        const res = await fetch('/api/interview/answer', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to submit answer to database');
        }

        const data = await res.json();
        setUploadProgress(90);

        const updatedAnswers = [...completedAnswers];
        updatedAnswers[currentQuestionIdx] = {
          question_number: currentQuestion.number,
          question: currentQuestion.text,
          video_url: videoUrl,
          transcript: data.transcript,
          duration_seconds: recordingDuration
        };
        setCompletedAnswers(updatedAnswers);

        // Advance question or complete
        if (currentQuestion.number < 3) {
          setCurrentQuestionIdx(currentQuestionIdx + 1);
          setInterview(prev => ({ ...prev, current_question: currentQuestion.number + 1 }));
        } else {
          // Trigger evaluation
          triggerRealEvaluation(interview.id);
        }

      // Reset recording states for next question
      setRecordedChunks([]);
      setRecordedUrl(null);
      setRecordingDuration(0);

    } catch (err: any) {
      console.error("Submission failed:", err);
      alert(`Error submitting answer: ${err.message || err}. Please try again.`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 7. Initial Interview Creation Action
  const handleStartInterview = async () => {
    try {
      setLoadingState(true);
      const res = await fetch('/api/interview/status', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setInterview(data.interview);
        setCurrentQuestionIdx(0);
        setCompletedAnswers([]);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Failed to start interview:", err);
      alert("Failed to start interview.");
    } finally {
      setLoadingState(false);
    }
  };

  // Real LLM evaluation
  const triggerRealEvaluation = async (intId: string) => {
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: intId })
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data.aiResult);
        setInterview(prev => ({ ...prev, status: 'review_ongoing' }));
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("AI Evaluation failed:", err);
      alert("We recorded your answers, but our evaluation engine is busy. Your review is currently ongoing.");
    } finally {
      setIsEvaluating(false);
      await refreshApplicantData();
    }
  };

  // Render Loading
  if (loadingState) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
          <Loader2 size={48} className="animate-spin text-[#DFFF00]" />
          <p className="text-sm text-gray-400">Loading placement interview engine...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Question metadata
  const currentQuestion = QUESTIONS[currentQuestionIdx];

  // Duration Helper
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <DashboardLayout>
      {/* Upper Navigation Indicator */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                Interactive AI Interview System
              </h1>
              <p className="text-xs text-gray-400">Sequence Stage 5 Assessment &bull; Automated Matchmaking Engine</p>
            </div>
          </div>
        </div>

      {/* --- STEP 1: BEFORE START SCREEN --- */}
      {!interview && (
        <div className="max-w-3xl mx-auto bg-[#26312f] rounded-[32px] p-8 md:p-12 border border-white/5 shadow-2xl text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#DFFF00]/5 blur-3xl rounded-full"></div>
          
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-[#DFFF00] tracking-widest uppercase block">Interactive Selection Phase</span>
            <h2 className="text-3xl font-black text-white tracking-tight">Placement Matchmaking Assessment</h2>
            <p className="text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
              Complete our structured 3-question interactive video/audio interview. This assessment evaluates your communication, drive, and technical knowledge-transfer to qualify you for the Deloxe Job Pool.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto text-left">
            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-2">
              <div className="w-8 h-8 bg-[#DFFF00]/10 text-[#DFFF00] rounded-lg flex items-center justify-center font-black text-sm">3</div>
              <h4 className="text-sm font-bold text-white">Questions</h4>
              <p className="text-xs text-gray-400 leading-relaxed">Covering career alignment, training transfer, and personal program goals.</p>
            </div>
            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-2">
              <div className="w-8 h-8 bg-[#DFFF00]/10 text-[#DFFF00] rounded-lg flex items-center justify-center"><Clock size={16} /></div>
              <h4 className="text-sm font-bold text-white">2 Minutes Max</h4>
              <p className="text-xs text-gray-400 leading-relaxed">Each question allows a maximum of 2 minutes video and audio capture.</p>
            </div>
            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-2">
              <div className="w-8 h-8 bg-[#DFFF00]/10 text-[#DFFF00] rounded-lg flex items-center justify-center"><CheckCircle size={16} /></div>
              <h4 className="text-sm font-bold text-white">AI Grading</h4>
              <p className="text-xs text-gray-400 leading-relaxed">Automated transcription and scoring for instant feedback and matching.</p>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleStartInterview}
              className="px-8 py-4 bg-[#DFFF00] hover:brightness-110 text-[#1a2321] text-sm font-black rounded-2xl transition-all shadow-lg inline-flex items-center gap-2"
            >
              Start Placement Interview <ChevronRight size={16} className="stroke-[3px]" />
            </button>
          </div>
        </div>
      )}

      {/* --- STEP 2: ACTIVE RECORDING / INTERVIEW WORKSPACE --- */}
      {interview && interview.status === 'in_progress' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Interview question and guide (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Stage Counter Card */}
            <div className="bg-[#26312f] rounded-[24px] p-6 border border-white/5 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#DFFF00] uppercase tracking-widest">Question {currentQuestion.number} of 3</span>
                <span className="text-xs font-mono text-gray-400">{currentQuestion.title}</span>
              </div>
              
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#DFFF00] transition-all duration-500 ease-out"
                  style={{ width: `${(currentQuestion.number / 3) * 100}%` }}
                ></div>
              </div>
              
              <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                {currentQuestion.text}
              </h3>
            </div>

            {/* Preparation Checklists */}
            <div className="bg-[#1e2624] rounded-[24px] p-6 border border-[#dbf0de]/5 text-left space-y-4">
              <h4 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                <Award size={14} className="text-[#DFFF00]" /> Recording Tips
              </h4>
              <ul className="text-xs text-gray-400 space-y-2.5 leading-relaxed">
                <li className="flex gap-2"><Check size={14} className="text-green-500 shrink-0 mt-0.5" /> Ensure your workspace is well lit.</li>
                <li className="flex gap-2"><Check size={14} className="text-green-500 shrink-0 mt-0.5" /> Speak clearly into your microphone.</li>
                <li className="flex gap-2"><Check size={14} className="text-green-500 shrink-0 mt-0.5" /> Aim to utilize 1 to 1.5 minutes of the allocated time.</li>
                <li className="flex gap-2"><Check size={14} className="text-green-500 shrink-0 mt-0.5" /> Use professional language and direct examples.</li>
              </ul>
            </div>
          </div>

          {/* Right panel: Active Camera Workspace (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* The main viewport */}
            <div className="relative aspect-video rounded-[32px] overflow-hidden bg-[#0f1412] border-2 border-white/5 shadow-2xl flex items-center justify-center">
              
              {/* Checking Permissions Screen */}
              {checkingPermissions && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0f1412] space-y-3">
                  <Loader2 size={32} className="animate-spin text-[#DFFF00]" />
                  <p className="text-xs text-gray-400">Syncing webcam and microphone...</p>
                </div>
              )}

              {/* No Permissions Block */}
              {!checkingPermissions && permissionsGranted === false && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#1a2321] p-8 text-center space-y-4">
                  <ShieldAlert size={48} className="text-red-400" />
                  <h3 className="text-lg font-bold text-white">Camera & Microphone Access Required</h3>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                    This interview requires simultaneous webcam and microphone access to record your video responses natively.
                  </p>
                  <button
                    onClick={() => checkDevicePermissions(true)}
                    className="px-5 py-2.5 bg-[#DFFF00] text-[#1a2321] text-xs font-black rounded-xl hover:scale-[1.02] transition-transform flex items-center gap-1.5"
                  >
                    Grant Browser Permissions <Mic size={14} />
                  </button>
                </div>
              )}

              {/* LIVE CAMERA PREVIEW */}
              {!recordedUrl && (
                <video 
                  ref={videoPreviewRef}
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
              )}

              {/* RECORDED PREVIEW REPLAY */}
              {recordedUrl && (
                <video 
                  ref={recordedReplayRef}
                  src={recordedUrl}
                  controls 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              )}

              {/* BLINKING REC INDICATOR */}
              {isRecording && (
                <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/60 rounded-full flex items-center gap-2 border border-white/10 animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="text-[10px] font-mono text-white font-black uppercase tracking-wider">REC</span>
                </div>
              )}

              {/* COUNTDOWN TIMER */}
              {isRecording && (
                <div className="absolute top-4 right-4 z-10 px-3 py-1 bg-black/60 rounded-full flex items-center gap-1.5 border border-white/10 font-mono text-xs font-bold text-[#DFFF00]">
                  <Clock size={12} /> {formatTime(120 - recordingDuration)}
                </div>
              )}

              {/* Uploading loading overlay */}
              {isUploading && (
                <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <Loader2 size={36} className="animate-spin text-[#DFFF00]" />
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-white">Uploading & Transcribing Answers</h4>
                    <p className="text-xs text-gray-400">Processing audio-to-text with AI. Please wait...</p>
                  </div>
                  <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#DFFF00] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* ACTION FOOTER BUTTONS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-[#26312f] rounded-2xl border border-white/5">
              
              {!recordedUrl ? (
                <>
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Workspace Mode</span>
                    <span className="text-xs text-white font-semibold flex items-center gap-1.5">
                      {isRecording ? (
                        <><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Recording Active...</>
                      ) : (
                        <><Video size={14} className="text-[#DFFF00]" /> Standby Preview</>
                      )}
                    </span>
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        disabled={checkingPermissions || permissionsGranted === false}
                        className="w-full sm:w-auto px-6 py-3 bg-[#DFFF00] text-[#1a2321] text-xs font-black rounded-xl hover:brightness-110 flex items-center justify-center gap-1.5 transition-all shadow-md"
                      >
                        <Play size={12} className="fill-current" /> Start Recording
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="w-full sm:w-auto px-6 py-3 bg-red-500 hover:bg-red-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md animate-pulse"
                      >
                        <Square size={12} className="fill-current" /> Stop Recording
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Review Captured Response</span>
                    <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                      <CheckCircle size={14} /> Duration: {formatTime(recordingDuration)}
                    </span>
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={handleRerecord}
                      disabled={isUploading}
                      className="w-full sm:w-auto px-5 py-3 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-xl border border-white/5 transition-all"
                    >
                      <RotateCcw size={12} className="inline mr-1" /> Re-record
                    </button>
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={isUploading}
                      className="w-full sm:w-auto px-6 py-3 bg-[#DFFF00] text-[#1a2321] text-xs font-black rounded-xl hover:brightness-110 flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      Submit Answer <ChevronRight size={13} className="stroke-[3px]" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- STEP 3: INTERVIEW SUBMITTED / REVIEW ONGOING SCREEN --- */}
      {interview && interview.status === 'review_ongoing' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-[#26312f] rounded-[32px] p-8 md:p-12 border border-white/5 shadow-2xl text-center space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#DFFF00]/5 blur-3xl rounded-full"></div>
            
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-[#DFFF00]/10 flex items-center justify-center text-[#DFFF00] animate-bounce">
                <Clock size={32} />
              </div>
            </div>

            <div className="space-y-3">
              <span className="px-3 py-1 bg-[#DFFF00]/10 text-[#DFFF00] border border-[#DFFF00]/25 rounded-full text-[10px] font-black uppercase tracking-wider inline-block">
                Interview Review Ongoing
              </span>
              <h2 className="text-3xl font-black text-white tracking-tight">AI Assessment in Progress</h2>
              <p className="text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
                Your three interactive video responses have been successfully compiled. Our recruitment grading algorithm and placement committee are generating your professional evaluation report.
              </p>
            </div>

            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl max-w-md mx-auto flex items-center gap-4 text-left">
              <Clock size={24} className="text-[#DFFF00] shrink-0" />
              <div>
                <span className="text-xs font-bold text-white block">Estimated Review Time</span>
                <span className="text-sm text-gray-400">Approximately 40 minutes remaining</span>
              </div>
            </div>

{/* Simulation accelerator removed */}
          </div>
        </div>
      )}

      {/* --- STEP 4: INTERVIEW COMPLETED & EVALUATION RESULTS DISPLAY --- */}
      {interview && interview.status === 'completed' && aiResult && (
        <div className="space-y-8 text-left">
          
          {/* Congrats / feedback top card */}
          {aiResult.recommendation === 'accepted' ? (
            <div className="bg-[#26312f] rounded-[32px] p-8 border-2 border-green-500/20 shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-green-500/5 blur-3xl rounded-full"></div>
              
              <div className="space-y-2 max-w-2xl">
                <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-wider rounded-full inline-block">
                  Congratulations! Passed
                </span>
                <h2 className="text-3xl font-black text-white tracking-tight">You passed the placement interview!</h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Your communication and career goals align perfectly with our hiring pipeline. The corporate matchmaking portal and <strong>Job Pool are now open</strong>!
                </p>
              </div>

              <button
                onClick={() => router.push('/dashboard/job-pool')}
                className="px-6 py-4 bg-[#DFFF00] text-[#1a2321] text-sm font-black rounded-2xl hover:scale-[1.02] transition-transform shadow-lg flex items-center gap-1.5 shrink-0"
              >
                Go to Job Pool <ArrowRight size={16} className="stroke-[3px]" />
              </button>
            </div>
          ) : (
            <div className="bg-[#26312f] rounded-[32px] p-8 border-2 border-yellow-500/20 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-yellow-500/5 blur-3xl rounded-full"></div>
              
              <div className="space-y-2 max-w-2xl">
                <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-wider rounded-full inline-block">
                  Evaluation Finished
                </span>
                <h2 className="text-3xl font-black text-white tracking-tight">Interview Completed & Reviewed</h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Thank you for completing your placement interview. Review your feedback below and continue practice to improve your career pitching skills.
                </p>
              </div>
            </div>
          )}

          {/* Detailed results breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left side: Scores & Strengths (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Executive Summary Card */}
              <div className="bg-[#26312f] rounded-[24px] p-6 border border-white/5 space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">Executive Summary</h4>
                <p className="text-sm text-[#dbf0de] font-medium leading-relaxed italic">
                  &ldquo;{aiResult.summary}&rdquo;
                </p>
              </div>

              {/* Score matrix */}
              <div className="bg-[#26312f] rounded-[24px] p-6 border border-white/5 space-y-6">
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">Grading Parameters</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Parameter progress trackers */}
                  {[
                    { label: 'Overall Readiness', val: aiResult.overall_score },
                    { label: 'Communication Skills', val: aiResult.communication_score },
                    { label: 'Confidence', val: aiResult.confidence_score },
                    { label: 'Professionalism', val: aiResult.professionalism_score },
                    { label: 'Career Alignment', val: aiResult.career_alignment_score },
                    { label: 'Training Transfer', val: aiResult.knowledge_score },
                    { label: 'Motivation', val: aiResult.motivation_score },
                    { label: 'Internship Readiness', val: aiResult.internship_readiness_score },
                  ].map((param, index) => (
                    <div key={index} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-300 font-medium">{param.label}</span>
                        <span className="font-bold text-[#DFFF00]">{param.val}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#DFFF00]/70 to-[#DFFF00] rounded-full"
                          style={{ width: `${param.val}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}

                </div>
              </div>

              {/* Strengths and areas to improve */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                <div className="bg-green-500/5 rounded-[24px] p-6 border border-green-500/10 space-y-4">
                  <h4 className="text-xs font-black uppercase text-green-400 tracking-wider flex items-center gap-1.5">
                    <CheckCircle size={14} /> Identified Strengths
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-3 leading-relaxed">
                    {aiResult.strengths.map((str: string, idx: number) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-green-400 shrink-0 mt-0.5">&bull;</span>
                        {str}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-yellow-500/5 rounded-[24px] p-6 border border-yellow-500/10 space-y-4">
                  <h4 className="text-xs font-black uppercase text-yellow-400 tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={14} /> Areas to Refine
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-3 leading-relaxed">
                    {aiResult.weaknesses.map((weak: string, idx: number) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-yellow-400 shrink-0 mt-0.5">&bull;</span>
                        {weak}
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

            </div>

            {/* Right side: Detailed feedback & Review (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              <div className="bg-[#26312f] rounded-[24px] p-6 border border-white/5 space-y-4">
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">Recruiter Feedback</h4>
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                  {aiResult.detailed_feedback}
                </p>
              </div>

              <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4 text-center">
                <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Verification Audit</span>
                <p className="text-[11px] text-gray-400 leading-normal">
                  This report has been securely registered on public placement chains under ID: <strong className="text-[#dbf0de] font-mono">{aiResult.id || 'sandbox-verified'}</strong>
                </p>
                <div className="flex gap-2 justify-center">
                  <span className="px-2.5 py-1 bg-white/5 rounded text-[9px] font-mono font-bold text-[#dbf0de]">DELX-ALIGNED</span>
                </div>
              </div>

            </div>

          </div>

{/* Admin panel reset button removed, functionality moved to API endpoint */}

        </div>
      )}

    </DashboardLayout>
  );
}
