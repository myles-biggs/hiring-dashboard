import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/roles";
import { JobPostForm } from "./_components/job-post-form";

export const metadata = { title: "Generate Job Post — Level Hire" };

export default async function NewJobPostPage() {
  const session = await getServerSession(authOptions);

  try {
    requireRole(session, "TALENT_ACQUISITION", "ADMIN");
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Generate Job Post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generates a bilingual (English + French Canadian) job post from role details. Review and
          edit before pushing to Workable.
        </p>
      </div>
      <JobPostForm />
    </div>
  );
}
