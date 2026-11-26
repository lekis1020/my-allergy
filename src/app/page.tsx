import { fetchInitialPapers } from "@/lib/papers/fetch-initial";
import { HomePage } from "@/components/papers/home-page";

// Timeline data is refreshed by a 6-hour sync cron, so the page does not need
// to be re-rendered on every request. Revalidate the cached render every 10
// minutes; per-user bookmark/like state is layered in client-side via SWR.
export const revalidate = 600;

export default async function Page() {
  const initialData = await fetchInitialPapers();

  return <HomePage initialData={initialData} />;
}
