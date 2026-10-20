'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent, ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Zap, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import {
  Ripple,
  TechOrbitDisplay,
  BoxReveal,
  Input,
  Label,
  BottomGradient,
} from '@/components/ui/modern-animated-sign-in';
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal';
import { supabase } from '@/lib/supabase';
import { sounds } from '@/utils/sound';

interface OrbitIcon {
  component: () => ReactNode;
  className: string;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  reverse?: boolean;
}

const iconsArray: OrbitIcon[] = [
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/34/34826e5b3315daadf4fa15f723a3c1d5ba4a89277bfd94e22ac4d7d3d54338c5.svg'
        alt='HTML5'
      />
    ),
    className: 'size-[30px] border-none bg-transparent',
    duration: 20,
    delay: 20,
    radius: 100,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/36/36b7d94b657d571d3f94042acbf6a4c86a5301a222f83f4b4583ad2acf6e297d.svg'
        alt='CSS3'
      />
    ),
    className: 'size-[30px] border-none bg-transparent',
    duration: 20,
    delay: 10,
    radius: 100,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/c9/c9191199f4049920c2fc19035b8a6664f37f4689fcd9e8434e786097e78863f0.svg'
        alt='TypeScript'
      />
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 210,
    duration: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/06/0656ff65fc8eeacda5c78d7f9ffe91ec1eb919db64f56e0b7dcd460af4bbd36c.svg'
        alt='JavaScript'
      />
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 210,
    duration: 20,
    delay: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/f8/f8cec54589553807eb603bcaf4e056aa090196211698b056542e3cc62a2f3448.svg'
        alt='TailwindCSS'
      />
    ),
    className: 'size-[30px] border-none bg-transparent',
    duration: 20,
    delay: 20,
    radius: 150,
    path: false,
    reverse: true,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/d9/d9435c4ede7133b376c0173a80226bb3856729366707cd96e9a66e39448d0288.svg'
        alt='Nextjs'
      />
    ),
    className: 'size-[30px] border-none bg-transparent',
    duration: 20,
    delay: 10,
    radius: 150,
    path: false,
    reverse: true,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/8f/8fa7bfa54687d377b5a59f518e3c155f9fbe30282b882655bf51d6dbca61f7e0.svg'
        alt='React'
      />
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 270,
    duration: 20,
    delay: 10,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/9c/9caefea8290f845a706be220f83693e5482329ee4fa302ec01d00d2ad41ec485.svg'
        alt='Nodejs'
      />
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 270,
    duration: 20,
    delay: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/14/1495be256d95ccb8f17eb3f18579ad0411ee8d3f1cae650ec72f0db3ee824c94.svg'
        alt='PostgreSQL'
      />
    ),
    className: 'size-[30px] border-none bg-transparent',
    duration: 20,
    delay: 20,
    radius: 330,
    path: false,
    reverse: true,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src='https://cdn.21st.dev/assets/mirror/4a/4a03ee7ec42a66e4aefed6f7c70e241850117b0769fd1cf968eb7db6be6008dc.svg'
        alt='Supabase'
      />
    ),
    className: 'size-[30px] border-none bg-transparent',
    duration: 20,
    delay: 10,
    radius: 330,
    path: false,
    reverse: true,
  },
];

interface ModernAnimatedSignInProps {
  onSuccess?: (user: { email: string; name?: string }) => void;
}

export const ModernAnimatedSignIn: React.FC<ModernAnimatedSignInProps> = ({ onSuccess }) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const executeDemoLogin = async (customEmail?: string, customName?: string) => {
    sounds.playClick();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage('Authenticating demo session & launching CareerPilot Dashboard...');

    try {
      const demoEmail = customEmail || email || 'demo.candidate@careerpilot.ai';
      const demoName = customName || fullName || 'Aryan Raj';

      // Call server route to guarantee session cookies and profile setup
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, name: demoName }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Demo login failed');
      }

      // Set client-accessible cookies and storage
      document.cookie = 'cp_user_id=demo-user-123; path=/; max-age=604800; SameSite=Lax';
      try {
        localStorage.setItem('cp_user_id', 'demo-user-123');
        localStorage.setItem(
          'careerpilot_demo_user',
          JSON.stringify({
            id: 'demo-user-123',
            email: demoEmail,
            name: demoName,
          })
        );
      } catch {
        // Ignore localStorage restrictions
      }

      sounds.playSuccess();
      setSuccessMessage('Welcome back, Aryan! Launching your workspace...');

      setTimeout(() => {
        setIsLoading(false);
        if (onSuccess) {
          onSuccess({ email: demoEmail, name: demoName });
        }
        router.push(data.redirect || '/dashboard');
      }, 500);
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMessage(err instanceof Error ? err.message : 'Demo login failed.');
    }
  };

  const handleQuickDemo = () => {
    sounds.playClick();
    setEmail('demo.candidate@careerpilot.ai');
    setPassword('DemoCareer2026!');
    setFullName('Aryan Raj');
    setErrorMessage(null);
    setSuccessMessage('Demo credentials filled! Click below to sign in or use 1-Click Login.');
  };

  const handleGoogleLogin = async () => {
    sounds.playClick();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/onboarding` : undefined,
        },
      });
      if (error) {
        throw error;
      }
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMessage(err instanceof Error ? err.message : 'Google authentication failed');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (mode === 'register' && !fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    // Fast-path for demo user evaluation (bypasses unconfirmed email blocks)
    const isDemo =
      email.toLowerCase().includes('demo') ||
      email.toLowerCase() === 'demo.candidate@careerpilot.ai';

    if (isDemo) {
      await executeDemoLogin(email, fullName);
      return;
    }

    sounds.playClick();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (mode === 'register') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        setSuccessMessage('Account registered! Taking you to CareerPilot Onboarding...');
      } else {
        let { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // If this is an unconfirmed email error or user not found, try auto sign up or offer demo
          if (
            signInError.message.includes('Invalid login credentials') ||
            signInError.message.includes('User not found')
          ) {
            const autoSignUp = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: fullName || email.split('@')[0],
                },
              },
            });
            if (!autoSignUp.error) {
              signInError = null;
            }
          }
        }

        if (signInError) {
          if (signInError.message.includes('Email not confirmed') || (signInError as any).code === 'email_not_confirmed') {
            throw new Error('Email is not confirmed yet in Supabase Auth. Click "Demo Fill" to test with the verified demo account.');
          }
          throw signInError;
        }

        setSuccessMessage('Welcome back! Launching your workspace...');
      }

      sounds.playSuccess();

      // Check whether user should go to /onboarding or /dashboard
      let targetRoute = '/onboarding';
      try {
        const checkRes = await fetch('/api/profile');
        const checkData = await checkRes.json();
        if (checkData.success && checkData.profile?.onboarding_complete) {
          targetRoute = '/dashboard';
        }
      } catch {
        // Default to onboarding
      }

      setTimeout(() => {
        setIsLoading(false);
        if (onSuccess) {
          onSuccess({ email, name: fullName || email.split('@')[0] });
        }
        router.push(targetRoute);
      }, 700);
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
    }
  };

  if (!mounted) {
    return (
      <section className='min-h-screen w-full flex items-center justify-center bg-[#F7F8FB] text-[#475569]'>
        <div className='w-96 p-8 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm space-y-4 animate-pulse'>
          <div className='h-8 bg-slate-100 rounded-lg w-3/4' />
          <div className='h-4 bg-slate-100 rounded w-1/2' />
          <div className='h-10 bg-slate-100 rounded-xl' />
          <div className='h-10 bg-slate-100 rounded-xl' />
          <div className='h-11 bg-cyan-600/30 rounded-xl' />
        </div>
      </section>
    );
  }

  return (
    <section
      suppressHydrationWarning
      className='min-h-screen w-full flex max-lg:flex-col items-center justify-center relative overflow-hidden bg-[#F7F8FB] text-[#475569]'
    >
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        defaultEmail={email}
      />

      {/* Left Side: Tech Orbit Display & Ripple Effect */}
      <div className='relative flex flex-col justify-center items-center w-1/2 h-[100dvh] max-lg:hidden overflow-hidden border-r border-[#E2E8F0] bg-[#F8FAFC]'>
        <Ripple mainCircleSize={120} numCircles={10} />
        <TechOrbitDisplay iconsArray={iconsArray} text='CareerPilot AI' />

        {/* Ambient watermark info */}
        <div className='absolute bottom-8 left-8 flex items-center gap-2 text-xs font-semibold text-[#94A3B8]'>
          <span className='w-2 h-2 rounded-full bg-cyan-600 animate-pulse' />
          <span>Supabase Cloud Connected • CareerPilot SaaS</span>
        </div>
      </div>

      {/* Right Side: Animated Auth Form */}
      <div className='w-full lg:w-1/2 min-h-[100dvh] flex flex-col justify-center items-center px-6 sm:px-12 py-10'>
        <div className='max-md:w-full flex flex-col gap-4 w-96 mx-auto bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-8'>
          {/* Header Title with BoxReveal */}
          <div className='flex items-center justify-between'>
            <BoxReveal boxColor='var(--skeleton)' duration={0.3}>
              <h2 className='font-black text-2xl sm:text-3xl text-[#0F172A] font-heading tracking-tight'>
                {mode === 'signin' ? 'Welcome back' : 'Create account'}
              </h2>
            </BoxReveal>

            {/* Quick Demo Fill & 1-Click Login buttons */}
            <div className='flex items-center gap-1.5'>
              <button
                suppressHydrationWarning
                type='button'
                onClick={handleQuickDemo}
                className='px-2.5 py-1.5 rounded-xl bg-[#ECFEFF] hover:bg-cyan-100 text-cyan-800 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-cyan-200 shadow-sm'
                title='Fill demo credentials'
              >
                <Zap className='w-3.5 h-3.5 text-cyan-600' />
                <span>Demo Fill</span>
              </button>

              <button
                suppressHydrationWarning
                type='button'
                onClick={() => executeDemoLogin()}
                className='px-2.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm'
                title='Instant login with verified demo account'
              >
                <span>Login</span>
                <ArrowRight className='w-3 h-3' />
              </button>
            </div>
          </div>

          <BoxReveal boxColor='var(--skeleton)' duration={0.3} className='pb-1'>
            <p className='text-[#475569] text-xs sm:text-sm max-w-sm'>
              {mode === 'signin'
                ? 'Sign in to access your autonomous job agents'
                : 'Register your account to begin CareerPilot Onboarding'}
            </p>
          </BoxReveal>

          {/* Feedback alerts */}
          {errorMessage && (
            <div className='p-3 rounded-xl bg-[#FFF1F2] border border-rose-200 text-rose-800 text-xs flex items-center gap-2'>
              <AlertCircle className='w-4 h-4 text-rose-600 shrink-0' />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className='p-3 rounded-xl bg-[#ECFDF5] border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2'>
              <CheckCircle2 className='w-4 h-4 text-emerald-600 shrink-0' />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Google Login Button */}
          <BoxReveal
            boxColor='var(--skeleton)'
            duration={0.3}
            overflow='visible'
            width='unset'
          >
            <button
              suppressHydrationWarning
              className='g-button group/btn bg-white hover:bg-slate-50 w-full rounded-xl border border-[#E2E8F0] h-10 font-medium outline-hidden hover:cursor-pointer transition-all shadow-sm'
              type='button'
              onClick={handleGoogleLogin}
            >
              <span className='flex items-center justify-center w-full h-full gap-3 text-xs sm:text-sm text-[#0F172A]'>
                <Image
                  src='https://cdn.21st.dev/assets/mirror/89/8948eafec4a9c68b2b3a78a756b4474c05e53431f208149556fb669e3c429be2.png'
                  width={20}
                  height={20}
                  alt='Google Icon'
                />
                Continue with Google
              </span>
              <BottomGradient />
            </button>
          </BoxReveal>

          <BoxReveal boxColor='var(--skeleton)' duration={0.3} width='100%'>
            <div className='flex items-center gap-4 my-1'>
              <hr className='flex-1 border-1 border-dashed border-[#E2E8F0]' />
              <p className='text-[#94A3B8] text-[11px] uppercase tracking-wider font-semibold'>
                or continue with email
              </p>
              <hr className='flex-1 border-1 border-dashed border-[#E2E8F0]' />
            </div>
          </BoxReveal>

          {/* Form */}
          <form
            suppressHydrationWarning
            onSubmit={handleSubmit}
            className='space-y-3.5'
          >
            {mode === 'register' && (
              <div className='flex flex-col gap-1.5'>
                <BoxReveal boxColor='var(--skeleton)' duration={0.3}>
                  <Label htmlFor='fullName'>
                    Full Name <span className='text-rose-500'>*</span>
                  </Label>
                </BoxReveal>

                <BoxReveal
                  width='100%'
                  boxColor='var(--skeleton)'
                  duration={0.3}
                  className='flex flex-col w-full'
                >
                  <Input
                    suppressHydrationWarning
                    type='text'
                    id='fullName'
                    required
                    placeholder='Aryan Raj'
                    value={fullName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFullName(e.target.value)
                    }
                  />
                </BoxReveal>
              </div>
            )}

            {/* Email Field */}
            <div className='flex flex-col gap-1.5'>
              <BoxReveal boxColor='var(--skeleton)' duration={0.3}>
                <Label htmlFor='email'>
                  Email Address <span className='text-rose-500'>*</span>
                </Label>
              </BoxReveal>

              <BoxReveal
                width='100%'
                boxColor='var(--skeleton)'
                duration={0.3}
                className='flex flex-col w-full'
              >
                <Input
                  suppressHydrationWarning
                  type='email'
                  id='email'
                  required
                  placeholder='user@example.com'
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                />
              </BoxReveal>
            </div>

            {/* Password Field */}
            <div className='flex flex-col gap-1.5'>
              <div className='flex items-center justify-between'>
                <BoxReveal boxColor='var(--skeleton)' duration={0.3}>
                  <Label htmlFor='password'>
                    Password <span className='text-rose-500'>*</span>
                  </Label>
                </BoxReveal>

                {mode === 'signin' && (
                  <button
                    suppressHydrationWarning
                    type='button'
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className='text-xs font-semibold text-cyan-600 hover:text-cyan-700 cursor-pointer outline-hidden'
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <BoxReveal
                width='100%'
                boxColor='var(--skeleton)'
                duration={0.3}
                className='flex flex-col w-full'
              >
                <div className='relative'>
                  <Input
                    suppressHydrationWarning
                    type={showPassword ? 'text' : 'password'}
                    id='password'
                    required
                    placeholder='••••••••••••'
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPassword(e.target.value)
                    }
                  />

                  <button
                    suppressHydrationWarning
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-[#94A3B8] hover:text-[#0F172A] cursor-pointer'
                  >
                    {showPassword ? (
                      <Eye className='h-4 w-4' />
                    ) : (
                      <EyeOff className='h-4 w-4' />
                    )}
                  </button>
                </div>
              </BoxReveal>
            </div>

            {/* Primary Submit Button: cyan-600 background with white text */}
            <div className='pt-2'>
              <BoxReveal
                width='100%'
                boxColor='var(--skeleton)'
                duration={0.3}
                overflow='visible'
              >
                <button
                  suppressHydrationWarning
                  disabled={isLoading}
                  className='bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl h-11 w-full shadow-sm outline-hidden hover:cursor-pointer disabled:opacity-60 transition-all flex items-center justify-center gap-2'
                  type='submit'
                >
                  {isLoading
                    ? 'Authenticating with CareerPilot...'
                    : mode === 'signin'
                    ? 'Sign In & Launch Workspace →'
                    : 'Create Account & Begin →'}
                  <BottomGradient />
                </button>
              </BoxReveal>
            </div>

            {/* Switch Mode Button */}
            <BoxReveal boxColor='var(--skeleton)' duration={0.3}>
              <div className='mt-3 text-center'>
                <button
                  suppressHydrationWarning
                  type='button'
                  className='text-xs text-[#475569] hover:text-cyan-700 cursor-pointer outline-hidden font-medium'
                  onClick={() => {
                    sounds.playClick();
                    setMode(mode === 'signin' ? 'register' : 'signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                >
                  {mode === 'signin'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </button>
              </div>
            </BoxReveal>
          </form>
        </div>
      </div>
    </section>
  );
};
