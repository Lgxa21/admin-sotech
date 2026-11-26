import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { contentStudioConfig } from "@/lib/content-studio";
import ContentStudio from "@/components/ContentStudio";

export const metadata = { title: "Content Studio" };
export const dynamic = "force-dynamic";

export default async function ContentStudioPage() {
  const user = await requireUser();
  if (!contentStudioConfig(user.role)) notFound();

  return (
    <section aria-labelledby="content-studio" className="grid min-w-0 gap-4">
      <h1 id="content-studio" className="h1">Content Studio</h1>
      <ContentStudio />
    </section>
  );
}
