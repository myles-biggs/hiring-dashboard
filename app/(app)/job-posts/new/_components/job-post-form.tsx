"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateJobPost, pushDraftToWorkable } from "@/lib/actions/job-post";
import { JobPostPreview } from "./job-post-preview";

interface GeneratedPost {
  english: string;
  french: string;
}

export function JobPostForm() {
  const [roleTitle, setRoleTitle] = useState("");
  const [roleContext, setRoleContext] = useState("");
  const [compRange, setCompRange] = useState("");
  const [location, setLocation] = useState("Remote – Canada/US");
  const [hardSkills, setHardSkills] = useState("");
  const [softSkills, setSoftSkills] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedPost | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);

  function parseSkills(raw: string): string[] {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setIsGenerating(true);
    setGenerateError(null);
    setGenerated(null);
    setDraftUrl(null);

    try {
      const result = await generateJobPost({
        roleTitle,
        roleContext,
        compRange: compRange || undefined,
        location: location || undefined,
        hardSkills: parseSkills(hardSkills),
        softSkills: parseSkills(softSkills),
      });
      setGenerated(result);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePushToWorkable(english: string, french: string) {
    const result = await pushDraftToWorkable({
      title: roleTitle,
      description: english,
      descriptionFrench: french,
    });
    setDraftUrl(result.draftUrl);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleGenerate} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="roleTitle">Role title</Label>
          <Input
            id="roleTitle"
            required
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="e.g. Senior Paid Media Manager"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="roleContext">Role context / description</Label>
          <Textarea
            id="roleContext"
            required
            rows={5}
            value={roleContext}
            onChange={(e) => setRoleContext(e.target.value)}
            placeholder="Describe the role, team context, what the person will own, and what success looks like."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="compRange">Compensation range (optional)</Label>
            <Input
              id="compRange"
              value={compRange}
              onChange={(e) => setCompRange(e.target.value)}
              placeholder="e.g. $80,000 – $95,000 CAD"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote – Canada/US"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="hardSkills">Hard skills (optional, comma-separated)</Label>
            <Input
              id="hardSkills"
              value={hardSkills}
              onChange={(e) => setHardSkills(e.target.value)}
              placeholder="e.g. Google Ads, Meta Ads, Excel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="softSkills">Soft skills (optional, comma-separated)</Label>
            <Input
              id="softSkills"
              value={softSkills}
              onChange={(e) => setSoftSkills(e.target.value)}
              placeholder="e.g. stakeholder management, written communication"
            />
          </div>
        </div>

        {generateError && (
          <p className="text-sm text-destructive" role="alert">
            {generateError}
          </p>
        )}

        <Button type="submit" disabled={isGenerating}>
          {isGenerating ? "Generating..." : "Generate Job Post"}
        </Button>
      </form>

      {generated && !draftUrl && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Preview &amp; edit</h2>
          <p className="text-sm text-muted-foreground">
            Both versions are editable. Make any changes before pushing to Workable.
          </p>
          <JobPostPreview
            english={generated.english}
            french={generated.french}
            onPushToWorkable={handlePushToWorkable}
          />
        </div>
      )}

      {draftUrl && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <p className="font-medium">Draft created in Workable.</p>
          <a
            href={draftUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block underline underline-offset-2"
          >
            Open draft in Workable
          </a>
        </div>
      )}
    </div>
  );
}
