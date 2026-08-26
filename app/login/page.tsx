'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSupabase } from '@/lib/supabase';
import { Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';

const supabase = getSupabase();

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');

  // Forgot password states
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error('Login error details:', error);
        if (error.message.includes('credentials')) {
          setErrorMessage('Incorrect password. Please check your credentials and try again.');
        } else {
          setErrorMessage(error.message);
        }
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setResetError(error.message);
      } else {
        setResetSuccess(true);
      }
    } catch (err) {
      setResetError('An unexpected error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
      {/* Background Image with subtle overlay */}
      <div className="fixed inset-0 -z-10">
        <Image 
          src="https://i.ibb.co/HDBsw5kC/Deloxe-hr-background-3.jpg" 
          alt="Deloxe HR Background" 
          fill 
          priority 
          className="object-cover object-center"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      </div>

      {/* Main Form Container with white transparent borders and frosted glass */}
      <div 
        id="login-card-container"
        className="relative bg-white/10 backdrop-blur-xl rounded-3xl border border-white/30 p-8 sm:p-12 max-w-md w-full shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all"
      >
        {mode === 'login' ? (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Welcome Back</h1>
              <p className="text-white/80 text-sm">Enter your credentials to access your dashboard.</p>
            </div>
            
            {errorMessage && (
              <div id="login-error-alert" className="mb-6 p-4 bg-red-500/25 border border-white/30 rounded-xl text-red-100 text-sm text-center backdrop-blur-sm">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-white/90 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input 
                  type="email" 
                  id="email"
                  name="email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="name@example.com" 
                  className="w-full bg-black/30 backdrop-blur-md p-4 rounded-xl border border-white/30 text-white placeholder-white/50 focus:border-white focus:ring-2 focus:ring-white/20 transition-all outline-none" 
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-white/90 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    id="password"
                    name="password"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="w-full bg-black/30 backdrop-blur-md p-4 pr-12 rounded-xl border border-white/30 text-white placeholder-white/50 focus:border-white focus:ring-2 focus:ring-white/20 transition-all outline-none" 
                    required
                  />
                  <button
                    type="button"
                    id="toggle-password-visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end text-sm">
                <button 
                  type="button"
                  id="forgot-password-toggle"
                  onClick={() => {
                    setMode('forgot');
                    setResetEmail(email);
                  }}
                  className="text-white/80 hover:text-white underline underline-offset-4 decoration-white/40 hover:decoration-white transition-colors text-xs font-medium"
                >
                  Forgot Password?
                </button>
              </div>

              <button 
                type="submit" 
                id="login-submit"
                name="login-submit"
                disabled={loading} 
                className="w-full px-6 py-4 bg-[#dbf0de] hover:bg-white text-[#1a2321] rounded-full font-bold border border-white/40 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={18} className="animate-spin text-[#1a2321]" />}
                {loading ? 'Logging in...' : 'Sign In'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <button 
                type="button"
                id="back-to-login-btn"
                onClick={() => setMode('login')}
                className="p-2 text-white/80 hover:text-white rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                aria-label="Back to login"
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="text-2xl font-bold text-white tracking-tight">Reset Password</h1>
            </div>
            
            <p className="text-white/80 mb-6 text-sm">
              Enter your email address and we will send you a secure link to reset your password.
            </p>

            {resetError && (
              <div id="reset-error-alert" className="mb-6 p-4 bg-red-500/25 border border-white/30 rounded-xl text-red-100 text-sm text-center backdrop-blur-sm">
                {resetError}
              </div>
            )}

            {resetSuccess ? (
              <div className="text-center space-y-6">
                <div className="p-4 bg-green-500/25 border border-white/30 rounded-xl text-green-100 text-sm text-center backdrop-blur-sm">
                  Password reset link sent! Check your inbox for further instructions.
                </div>
                <button 
                  type="button"
                  id="reset-success-back-btn"
                  onClick={() => {
                    setMode('login');
                    setResetSuccess(false);
                  }}
                  className="w-full px-6 py-4 bg-[#dbf0de] hover:bg-white text-[#1a2321] rounded-full font-bold border border-white/40 shadow-lg transition-all hover:scale-[1.02]"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-semibold text-white/90 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    id="reset-email"
                    name="reset-email"
                    value={resetEmail} 
                    onChange={(e) => setResetEmail(e.target.value)} 
                    placeholder="name@example.com" 
                    className="w-full bg-black/30 backdrop-blur-md p-4 rounded-xl border border-white/30 text-white placeholder-white/50 focus:border-white focus:ring-2 focus:ring-white/20 transition-all outline-none" 
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  id="send-reset-link-btn"
                  disabled={resetLoading} 
                  className="w-full px-6 py-4 bg-[#dbf0de] hover:bg-white text-[#1a2321] rounded-full font-bold border border-white/40 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {resetLoading && <Loader2 size={18} className="animate-spin text-[#1a2321]" />}
                  {resetLoading ? 'Sending link...' : 'Send Reset Link'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}

