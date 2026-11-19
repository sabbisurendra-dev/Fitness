import React from "react";
import OnboardingGateway from "@/components/OnboardingGateway";

interface HomePageProps {
  searchParams?: Promise<{ new?: string; choose?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const suppressAutoRedirect =
    params?.new === "1" || params?.choose === "1";

  return <OnboardingGateway suppressAutoRedirect={suppressAutoRedirect} />;
}
