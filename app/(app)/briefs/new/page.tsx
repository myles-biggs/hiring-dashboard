import { BriefForm } from "@/components/brief/BriefForm";

export default function NewBriefPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">New hiring brief</h1>
        <p className="text-sm text-gray-500 mt-1">
          Complete all required fields. The brief goes to Lonn for approval before a JD is generated.
        </p>
      </div>
      <BriefForm />
    </div>
  );
}
