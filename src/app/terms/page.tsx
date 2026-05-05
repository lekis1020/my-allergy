import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관 | My Allergy",
  description:
    "My Allergy 플랫폼의 이용약관입니다. 콘텐츠 출처, AI 생성 콘텐츠 면책, 의료 정보 면책 조항을 안내합니다.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
          이용약관
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          최종 업데이트: 2025년 5월 1일
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <Section title="1. 서비스 개요">
          <p>
            My Allergy(이하 &ldquo;서비스&rdquo;)는 알레르기 및 임상면역학 분야의
            주요 학술 저널에서 발표된 논문을 수집, 분석, 큐레이션하여 제공하는 연구
            정보 플랫폼입니다. 서비스를 이용함으로써 본 이용약관에 동의하는 것으로
            간주됩니다.
          </p>
        </Section>

        <Section title="2. 콘텐츠 출처 및 저작권">
          <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
            2.1 학술 논문 데이터
          </h4>
          <p className="mb-3">
            서비스에 표시되는 논문의 제목, 저자, 초록, 키워드, MeSH 용어 등은
            미국 국립의학도서관(NLM)이 운영하는{" "}
            <a
              href="https://pubmed.ncbi.nlm.nih.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              PubMed/MEDLINE
            </a>
            에서 제공하는 공개 데이터입니다. 이 데이터는 NLM의 이용 약관에 따라
            사용됩니다. 각 논문의 전문(full text)은 해당 저널 출판사의 저작권에
            의해 보호됩니다.
          </p>

          <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
            2.2 피인용 데이터
          </h4>
          <p className="mb-3">
            논문의 피인용 횟수 정보는{" "}
            <a
              href="https://www.crossref.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              CrossRef
            </a>
            API를 통해 수집됩니다.
          </p>

          <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
            2.3 오리지널 콘텐츠
          </h4>
          <p>
            AI 핵심 요약, 트렌드 분석 리포트, 토픽 분류, 저자 인사이트, 사용자
            인터페이스 디자인 등은 My Allergy의 독자적인 창작물이며, 관련 지적
            재산권은 서비스 운영자에게 귀속됩니다.
          </p>
        </Section>

        <Section title="3. AI 생성 콘텐츠 면책">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="mb-2">
              서비스에서 제공하는 AI 기반 핵심 요약, 트렌드 분석, 논문 Q&A 등은
              인공지능(Google Gemini)이 자동 생성한 콘텐츠입니다.
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                AI 생성 콘텐츠는 참고 자료로만 활용해야 하며, 원본 논문을 대체하지 않습니다.
              </li>
              <li>
                내용의 정확성이나 완전성을 보증하지 않습니다. 중요한 의사결정에는 반드시
                원본 논문을 직접 확인하세요.
              </li>
              <li>
                AI가 생성한 요약이나 분석이 원저자의 의도를 정확히 반영하지 않을 수
                있습니다.
              </li>
            </ul>
          </div>
        </Section>

        <Section title="4. 의료 정보 면책">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="mb-2 font-semibold text-red-800 dark:text-red-300">
              본 서비스는 의료 조언을 제공하지 않습니다.
            </p>
            <p>
              서비스에 게시된 모든 콘텐츠는 학술 연구 정보 제공을 목적으로 합니다.
              특정 환자의 진단, 치료, 예방에 관한 의료적 판단을 대체하지 않으며,
              의료 전문가의 직접적인 진료를 대신하지 않습니다. 건강 관련
              결정은 반드시 담당 의료 전문가와 상의하시기 바랍니다.
            </p>
          </div>
        </Section>

        <Section title="5. 사용자 생성 콘텐츠">
          <p className="mb-2">
            사용자는 Agora(댓글/토론)를 통해 콘텐츠를 작성할 수 있습니다.
            사용자가 작성한 콘텐츠에 대해 다음 사항에 동의합니다:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              허위 정보, 비방, 광고, 스팸 등 부적절한 콘텐츠를 게시하지 않습니다.
            </li>
            <li>
              타인의 저작권이나 개인정보를 침해하는 콘텐츠를 게시하지 않습니다.
            </li>
            <li>
              서비스 운영자는 약관을 위반하는 콘텐츠를 사전 통보 없이 삭제할 수
              있습니다.
            </li>
          </ul>
        </Section>

        <Section title="6. 서비스 이용 제한">
          <ul className="list-inside list-disc space-y-1">
            <li>
              API를 통한 대량 자동 수집(스크래핑)은 허용되지 않습니다.
            </li>
            <li>
              서비스에 과도한 부하를 주는 행위(분당 60회 이상 요청 등)는 자동으로
              제한됩니다.
            </li>
            <li>
              서비스의 보안을 위협하거나 정상적인 운영을 방해하는 행위는 금지됩니다.
            </li>
          </ul>
        </Section>

        <Section title="7. 서비스 변경 및 중단">
          <p>
            서비스 운영자는 서비스의 내용을 수정, 추가, 중단할 수 있으며, 이에
            대해 사전 고지를 위해 합리적인 노력을 기울이되, 긴급한 경우 사후에
            고지할 수 있습니다. 서비스 제공 중단으로 인한 손해에 대해 책임을 지지
            않습니다.
          </p>
        </Section>

        <Section title="8. 면책 조항">
          <p>
            서비스는 &ldquo;있는 그대로(as is)&rdquo; 제공되며, 콘텐츠의 정확성,
            완전성, 적시성에 대해 명시적 또는 묵시적 보증을 하지 않습니다. PubMed,
            CrossRef 등 외부 데이터 소스의 오류나 지연에 대해서도 책임을 지지
            않습니다.
          </p>
        </Section>

        <Section title="9. 약관 변경">
          <p>
            본 약관은 관련 법령 변경이나 서비스 운영 정책 변경에 따라 수정될 수
            있습니다. 변경된 약관은 서비스 내 게시를 통해 효력이 발생합니다.
          </p>
        </Section>

        <Section title="10. 문의">
          <p>
            약관에 관한 문의사항은{" "}
            <a
              href="mailto:contact@my-allergy.com"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              contact@my-allergy.com
            </a>
            으로 연락해 주세요.
          </p>
        </Section>

        <div className="border-t border-gray-200 pt-6 text-center dark:border-gray-800">
          <div className="flex justify-center gap-4">
            <Link
              href="/about"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              서비스 소개
            </Link>
            <Link
              href="/privacy"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              개인정보처리방침
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      {children}
    </section>
  );
}
