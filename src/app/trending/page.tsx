import type { Metadata } from "next";
import { TrendingFeed } from "@/components/papers/trending-feed";

export const metadata: Metadata = {
  title: "Trending | My Allergy",
};

export default function TrendingPage() {
  return <TrendingFeed />;
}
