import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 | My Allergy",
  description:
    "My Allergy 플랫폼의 개인정보처리방침입니다. 수집하는 정보, 이용 목적, 보호 조치에 대해 안내합니다.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
          개인정보처리방침
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          최종 업데이트: 2025년 5월 1일
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <Section title="1. 개요">
          <p>
            My Allergy(이하 &ldquo;서비스&rdquo;)는 알레르기 및 임상면역학 연구 논문
            큐레이션 플랫폼으로, 사용자의 개인정보를 소중히 다룹니다. 본
            개인정보처리방침은 서비스를 이용하는 과정에서 수집되는 정보와 그 활용
            방법을 설명합니다.
          </p>
        </Section>

        <Section title="2. 수집하는 정보">
          <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
            2.1 계정 정보
          </h4>
          <p className="mb-3">
            Google OAuth를 통해 로그인할 경우, Google에서 제공하는 기본 프로필
            정보(이름, 이메일 주소, 프로필 사진)를 수집합니다. 이 정보는 Supabase
            인증 시스템을 통해 안전하게 저장됩니다.
          </p>

          <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
            2.2 이용 데이터
          </h4>
          <p className="mb-3">
            서비스 이용 과정에서 다음 정보가 자동으로 수집될 수 있습니다:
          </p>
          <ul className="mb-3 list-inside list-disc space-y-1">
            <li>북마크, 좋아요, 댓글 등 서비스 내 활동 기록</li>
            <li>키워드 알림 설정</li>
            <li>토픽 모니터링 설정 (브라우저 로컬 스토리지에 저장)</li>
          </ul>

          <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
            2.3 기술 데이터
          </h4>
          <p>
            서비스 제공 및 품질 향상을 위해 IP 주소, 브라우저 유형, 기기 정보,
            방문 페이지, 접속 시간 등의 기술적 데이터를 수집할 수 있습니다.
          </p>
        </Section>

        <Section title="3. 정보 이용 목적">
          <ul className="list-inside list-disc space-y-1">
            <li>서비스 제공 및 사용자 인증</li>
            <li>개인화된 논문 추천 및 토픽 모니터링</li>
            <li>키워드 알림 발송</li>
            <li>서비스 이용 통계 분석 및 품질 개선</li>
            <li>부정 이용 방지 및 보안</li>
          </ul>
        </Section>

        <Section title="4. 제3자 서비스">
          <p className="mb-3">
            서비스 운영을 위해 다음 제3자 서비스를 이용합니다:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>Supabase:</strong> 데이터베이스 및 사용자 인증. 데이터는 암호화되어 저장됩니다.
            </li>
            <li>
              <strong>Google AdSense:</strong> 광고 제공. Google의 광고 쿠키가 사용될 수 있습니다.{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Google 개인정보처리방침
              </a>
              을 참조하세요.
            </li>
            <li>
              <strong>Vercel:</strong> 서비스 호스팅 및 CDN.
            </li>
            <li>
              <strong>Google Generative AI:</strong> AI 기반 논문 요약 생성. 논문 초록 데이터가 처리됩니다.
            </li>
          </ul>
        </Section>

        <Section title="5. 쿠키">
          <p>
            서비스는 사용자 인증 세션 유지를 위한 필수 쿠키를 사용합니다. 또한
            Google AdSense를 통해 광고 관련 쿠키가 설정될 수 있습니다. 사용자는
            브라우저 설정에서 쿠키를 관리하거나 거부할 수 있으나, 이 경우 일부
            서비스 기능이 제한될 수 있습니다.
          </p>
        </Section>

        <Section title="6. 데이터 보관 및 삭제">
          <p>
            사용자 계정 정보 및 활동 데이터는 계정이 활성 상태인 동안 보관됩니다.
            계정 삭제를 요청할 경우, 관련 개인정보는 합리적인 기간 내에 삭제됩니다.
            다만, 법적 의무에 따라 일부 데이터는 보관될 수 있습니다.
          </p>
        </Section>

        <Section title="7. 데이터 보안">
          <p>
            HTTPS 암호화 통신, Supabase Row Level Security, CSP(Content Security
            Policy) 등 기술적 보안 조치를 적용하여 사용자 데이터를 보호합니다.
          </p>
        </Section>

        <Section title="8. 아동 보호">
          <p>
            본 서비스는 의료 전문가 및 연구자를 대상으로 하며, 14세 미만 아동의
            이용을 대상으로 하지 않습니다. 14세 미만 아동의 개인정보가 수집된 것을
            인지할 경우, 즉시 해당 정보를 삭제합니다.
          </p>
        </Section>

        <Section title="9. 변경 사항">
          <p>
            본 방침은 관련 법령 변경이나 서비스 운영 정책 변경에 따라 수정될 수
            있습니다. 중요한 변경 사항이 있을 경우 서비스 내에서 고지합니다.
          </p>
        </Section>

        <Section title="10. 문의">
          <p>
            개인정보 관련 문의사항은{" "}
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
              href="/terms"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              이용약관
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
