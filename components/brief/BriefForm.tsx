"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { briefSchema, BriefFormValues, DEPARTMENTS, EMPLOYMENT_TYPES } from "@/lib/schemas/brief"

export function BriefForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<BriefFormValues>({ resolver: zodResolver(briefSchema) as any })

  async function onSubmit(data: BriefFormValues) {
    setSubmitting(true)
    setError(null)

    const res = await fetch("/api/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const body = await res.json()
      setError(body.error?.formErrors?.[0] ?? "Something went wrong. Please try again.")
      setSubmitting(false)
      return
    }

    const { id } = await res.json()
    router.push(`/briefs/${id}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Role basics */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Role basics</h2>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Role title" error={errors.roleTitle?.message}>
            <input {...register("roleTitle")} placeholder="e.g. SEO Specialist" className={inputClass} />
          </Field>

          <Field label="Department" error={errors.department?.message}>
            <select {...register("department")} className={inputClass}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>

          <Field label="Employment type" error={errors.employmentType?.message}>
            <select {...register("employmentType")} className={inputClass}>
              <option value="">Select type</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field label="Hiring manager email" error={errors.hiringManagerEmail?.message}>
            <input
              {...register("hiringManagerEmail")}
              type="email"
              placeholder="manager@levelagency.com"
              className={inputClass}
            />
          </Field>

          <Field label="Salary range min ($)" error={errors.salaryRangeMin?.message}>
            <input
              {...register("salaryRangeMin", { valueAsNumber: true })}
              type="number"
              placeholder="60000"
              className={inputClass}
            />
          </Field>

          <Field label="Salary range max ($)" error={errors.salaryRangeMax?.message}>
            <input
              {...register("salaryRangeMax", { valueAsNumber: true })}
              type="number"
              placeholder="80000"
              className={inputClass}
            />
          </Field>

          <Field label="Years of experience required" error={errors.yearsExperience?.message}>
            <input
              {...register("yearsExperience", { valueAsNumber: true })}
              type="number"
              placeholder="3"
              className={inputClass}
            />
          </Field>

          <Field label="Target start date" error={errors.targetStartDate?.message}>
            <input {...register("targetStartDate")} type="date" className={inputClass} />
          </Field>
        </div>

        <Field label="Role summary" error={errors.roleSummary?.message}>
          <textarea
            {...register("roleSummary")}
            rows={4}
            placeholder="What will this person own? What does success look like in 90 days?"
            className={inputClass}
          />
        </Field>
      </section>

      {/* Skills */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Skills</h2>

        <Field label="Hard skills required" error={errors.hardSkills?.message}>
          <textarea
            {...register("hardSkills")}
            rows={2}
            placeholder="e.g. Google Ads, Meta Ads, data analysis, client communication"
            className={inputClass}
          />
        </Field>

        <Field label="Soft skills required" error={errors.softSkills?.message}>
          <textarea
            {...register("softSkills")}
            rows={2}
            placeholder="e.g. Ownership mindset, systems thinking, comfort with ambiguity"
            className={inputClass}
          />
        </Field>
      </section>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Submitting..." : "Submit brief"}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

const inputClass =
  "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
