import React from 'react';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[#0B0614] text-slate-100 flex flex-col justify-center">
      <OnboardingWizard />
    </main>
  );
}
