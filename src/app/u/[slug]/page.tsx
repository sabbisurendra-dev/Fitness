import type { Metadata } from "next";
import FitnessDashboard from "@/components/FitnessDashboard";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

interface UserSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function UserSlugPage({ params }: UserSlugPageProps) {
  const { slug } = await params;
  return <FitnessDashboard initialSlug={slug} />;
}
