import type { Metadata } from "next";
import { ClinicalTrialsFeed } from "@/components/papers/clinical-trials-feed";

export const metadata: Metadata = {
  title: "Clinical Trials | My Allergy",
};

export default function ClinicalTrialsPage() {
  return <ClinicalTrialsFeed />;
}
