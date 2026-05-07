import type { Metadata } from "next";
import { Stethoscope, Sparkles, BookOpen, Users, TrendingUp, Shield } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | My Allergy",
  description:
    "My Allergy는 알레르기 및 임상면역학 전문의가 운영하는 연구 큐레이션 플랫폼입니다. AI 기반 논문 분석, 트렌드 리포트, 커뮤니티 토론을 제공합니다.",
  openGraph: {
    title: "About | My Allergy",
    description:
      "알레르기 전문의가 큐레이션하는 연구 포털 — AI 분석, 트렌드 리포트, 전문가 커뮤니티",
  },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Hero */}
      <header className="mb-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
          <Stethoscope className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          About My Allergy
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          알레르기 및 임상면역학 전문의가 운영하는 연구 큐레이션 플랫폼
        </p>
      </header>

      <div className="space-y-10 text-gray-700 dark:text-gray-300">
        {/* Mission */}
        <section>
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
            미션
          </h2>
          <p className="mb-3 leading-relaxed">
            My Allergy는 알레르기 및 임상면역학 분야의 최신 연구를 임상의와 연구자가
            빠르고 효율적으로 파악할 수 있도록 돕기 위해 만들어졌습니다. 매주 수백 편씩
            출판되는 논문 속에서 임상적으로 의미 있는 연구를 놓치지 않도록, 전문의의
            시각으로 큐레이션하고 AI 기술로 분석을 더합니다.
          </p>
          <p className="leading-relaxed">
            단순히 PubMed 데이터를 미러링하는 것이 아니라, 각 논문에 대한 AI 기반 핵심
            요약, 임상적 의의 분석, 연구 트렌드 종합 리포트 등 독자적인 부가가치를
            제공하여 바쁜 임상의의 문헌 검토 시간을 획기적으로 줄여줍니다.
          </p>
        </section>

        {/* What we do differently */}
        <section>
          <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
            My Allergy만의 차별점
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <FeatureCard
              icon={<Sparkles className="h-5 w-5 text-purple-500" />}
              title="AI 기반 논문 분석"
              description="모든 논문에 대해 AI가 핵심 내용을 한국어로 요약하고, 임상적 의의를 분석합니다. 초록을 처음부터 끝까지 읽지 않아도 논문의 핵심을 빠르게 파악할 수 있습니다."
            />
            <FeatureCard
              icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
              title="월간 트렌드 리포트"
              description="매월 AI가 해당 기간 출판된 논문을 종합 분석하여 연구 동향 리포트를 생성합니다. 어떤 주제가 활발히 연구되고 있는지 한눈에 파악할 수 있습니다."
            />
            <FeatureCard
              icon={<BookOpen className="h-5 w-5 text-emerald-500" />}
              title="전문가 큐레이션"
              description="알레르기 전문의가 선정한 9개 핵심 저널의 논문만 수록합니다. Impact Factor, 임상 관련성, 연구 품질을 기준으로 분야 최고 수준의 저널을 엄선했습니다."
            />
            <FeatureCard
              icon={<Users className="h-5 w-5 text-amber-500" />}
              title="전문가 커뮤니티"
              description="Agora에서 각 논문에 대한 의견을 나누고, 임상 적용 가능성을 함께 토론할 수 있습니다. 실제 임상 현장의 관점에서 연구를 재조명합니다."
            />
          </div>
        </section>

        {/* Curated Journals */}
        <section>
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
            큐레이션 저널 목록
          </h2>
          <p className="mb-4 leading-relaxed">
            다음 저널들은 알레르기 및 임상면역학 분야에서 학술적 영향력과 임상적
            관련성을 기준으로 엄선되었습니다. 각 저널의 최신 논문을 매일 자동으로
            수집하고 분석합니다.
          </p>
          <ul className="space-y-2">
            {JOURNALS.map((j) => (
              <li key={j.name} className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {j.name}
                  </span>
                  {j.note && (
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      — {j.note}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section>
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
            작동 방식
          </h2>
          <div className="space-y-4">
            <Step
              number={1}
              title="논문 수집"
              description="PubMed E-Utilities API를 통해 큐레이션 저널의 최신 논문 메타데이터(제목, 저자, 초록, 키워드, MeSH 용어)를 매일 자동 수집합니다."
            />
            <Step
              number={2}
              title="데이터 보강"
              description="CrossRef API로 피인용 횟수를 보강하고, Unpaywall을 통해 오픈 액세스 PDF 링크를 확인합니다. 논문 간 인용 관계 그래프도 구축합니다."
            />
            <Step
              number={3}
              title="AI 분석"
              description="AI가 각 논문의 초록을 분석하여 한국어 핵심 요약과 임상적 의의를 생성합니다. 토픽 태그를 자동 분류하여 천식, 비염, 두드러기, 식품 알레르기 등 주제별 탐색을 지원합니다."
            />
            <Step
              number={4}
              title="트렌드 종합"
              description="월별로 출판된 논문을 종합 분석하여 연구 동향 리포트를 생성합니다. 어떤 주제가 활발히 연구되고 있는지, 새로운 치료법이나 진단법은 무엇인지 파악할 수 있습니다."
            />
          </div>
        </section>

        {/* Content policy */}
        <section>
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
            콘텐츠 정책
          </h2>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                출처 명시 및 부가가치 원칙
              </h3>
            </div>
            <ul className="space-y-2 text-sm leading-relaxed">
              <li>
                <strong>논문 메타데이터:</strong> 제목, 저자, 초록 등은 PubMed/MEDLINE에서
                제공하는 공개 데이터입니다. 출처를 명시하고, 각 논문에 PubMed 원문 링크를
                제공합니다.
              </li>
              <li>
                <strong>AI 분석 콘텐츠:</strong> 핵심 요약, 트렌드 리포트, 토픽 분류 등은
                My Allergy 플랫폼에서 독자적으로 생성한 오리지널 콘텐츠입니다.
              </li>
              <li>
                <strong>커뮤니티 콘텐츠:</strong> 사용자 댓글, 토론, 북마크 컬렉션 등은
                사용자가 직접 생성한 콘텐츠입니다.
              </li>
              <li>
                <strong>의료 정보 면책:</strong> 본 플랫폼의 콘텐츠는 학술 연구 정보
                제공을 목적으로 하며, 특정 환자에 대한 의료 조언을 대체하지 않습니다.
              </li>
            </ul>
          </div>
        </section>

        {/* Who is it for */}
        <section>
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
            대상 독자
          </h2>
          <ul className="space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>
                알레르기 및 임상면역학 전문의, 전임의, 수련의
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>
                관련 분야 연구자 (기초, 중개, 임상 연구)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>
                소아과, 내과, 이비인후과 등 알레르기 진료를 담당하는 임상의
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>
                약학, 간호학 등 보건의료 분야 전문가
              </span>
            </li>
          </ul>
        </section>

        {/* Contact */}
        <section className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            문의 사항이나 피드백은{" "}
            <a
              href="https://x.com/lekis1020"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              @lekis1020
            </a>
            으로 연락해 주세요.
          </p>
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <Link
              href="/privacy"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              개인정보처리방침
            </Link>
            <Link
              href="/terms"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              이용약관
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

const JOURNALS = [
  { name: "Journal of Allergy and Clinical Immunology (JACI)", note: "IF 14.2" },
  { name: "JACI: In Practice", note: "IF 8.9" },
  { name: "Allergy", note: "IF 12.6" },
  { name: "Clinical and Experimental Allergy", note: "IF 6.3" },
  { name: "Clinical Reviews in Allergy & Immunology", note: "IF 8.4" },
  { name: "Allergology International", note: "IF 5.1" },
  { name: "Journal of Investigational Allergology and Clinical Immunology", note: null },
  { name: "Annals of Allergy, Asthma & Immunology", note: null },
  { name: "Current Allergy and Asthma Reports", note: null },
];

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
        {number}
      </div>
      <div>
        <h3 className="mb-1 font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
}
