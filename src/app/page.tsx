import React, { Suspense } from "react";
import OnboardingGateway from "@/components/OnboardingGateway";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-[var(--text-muted)]">
          Loading PulseLoop...
        </div>
      }
    >
      <OnboardingGateway />
    </Suspense>
  );
}
