"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface JobPostPreviewProps {
  english: string;
  french: string;
  /**
   * Called with the current (possibly edited) content when the user clicks
   * "Push Draft to Workable". The parent resolves the Workable URL and handles
   * success state — this component only handles the edit/submit interaction.
   */
  onPushToWorkable: (english: string, french: string) => Promise<void>;
}

export function JobPostPreview({ english, french, onPushToWorkable }: JobPostPreviewProps) {
  const [editedEnglish, setEditedEnglish] = useState(english);
  const [editedFrench, setEditedFrench] = useState(french);
  const [isPushing, setIsPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  async function handlePush() {
    setIsPushing(true);
    setPushError(null);
    try {
      await onPushToWorkable(editedEnglish, editedFrench);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Failed to push to Workable.");
      setIsPushing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="english">
        <TabsList>
          <TabsTrigger value="english">English</TabsTrigger>
          <TabsTrigger value="french">French (CA)</TabsTrigger>
        </TabsList>

        <TabsContent value="english" className="mt-3">
          <textarea
            className="h-[520px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={editedEnglish}
            onChange={(e) => setEditedEnglish(e.target.value)}
            aria-label="English job post"
          />
        </TabsContent>

        <TabsContent value="french" className="mt-3">
          <textarea
            className="h-[520px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={editedFrench}
            onChange={(e) => setEditedFrench(e.target.value)}
            aria-label="French (CA) job post"
          />
        </TabsContent>
      </Tabs>

      {pushError && (
        <p className="text-sm text-destructive" role="alert">
          {pushError}
        </p>
      )}

      <Button onClick={handlePush} disabled={isPushing}>
        {isPushing ? "Pushing to Workable..." : "Push Draft to Workable"}
      </Button>
    </div>
  );
}
