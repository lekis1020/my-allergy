import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Daily cron job that generates trending analysis using Gemini.
 * Runs at 06:00 UTC every day.
 */
export const generateTrendingAnalysisFn = inngest.createFunction(
  { id: "generate-trending-analysis", retries: 2 },
  { cron: "0 6 * * *" },
  async ({ step }) => {
    const stats = await step.run("collect-stats", async () => {
      const supabase = createServiceClient();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: papers } = await supabase
        .from("papers")
        .select("keywords, publication_date")
        .gte("publication_date", thirtyDaysAgo.toISOString().split("T")[0]);

      const topicCounts = new Map<string, number>();
      for (const p of papers ?? []) {
        for (const tag of (p.keywords as string[]) ?? []) {
          topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
        }
      }

      const topTopics = Array.from(topicCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return { totalPapers: papers?.length ?? 0, topTopics };
    });

    const aiSummary = await step.run("generate-analysis", async () => {
      const { getGeminiClient } = await import("@/lib/gemini/client");
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `다음은 알레르기/임상면역학 분야 최근 30일간 논문 통계입니다:

총 논문 수: ${stats.totalPapers}편
토픽별 분포: ${stats.topTopics.map((t) => `${t.name}(${t.count}편)`).join(", ")}

이 데이터를 바탕으로 한국어로 2~3문단의 연구 동향 분석을 작성하세요.
주요 토픽별 연구 동향, 주목할 만한 변화, 새로운 연구 방향을 포함하세요.
마크다운 서식 없이 일반 텍스트로 작성하세요.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      return result.response.text()?.trim() ?? "";
    });

    await step.run("save-analysis", async () => {
      const supabase = createServiceClient();
      const today = new Date().toISOString().split("T")[0];

      await supabase.from("trending_analysis").upsert(
        { date: today, ai_summary: aiSummary, stats_json: stats },
        { onConflict: "date" }
      );
    });

    return { date: new Date().toISOString().split("T")[0], stats };
  }
);
