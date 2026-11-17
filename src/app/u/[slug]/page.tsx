import FitnessDashboard from "@/components/FitnessDashboard";

interface UserSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function UserSlugPage({ params }: UserSlugPageProps) {
  const { slug } = await params;
  return <FitnessDashboard initialSlug={slug} />;
}
