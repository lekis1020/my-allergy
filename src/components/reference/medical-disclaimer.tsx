import Link from "next/link";

export function MedicalDisclaimer() {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-gray-700 dark:border-red-800 dark:bg-red-900/20 dark:text-gray-300">
      <p className="mb-2 font-semibold text-red-800 dark:text-red-300">
        본 서비스는 의료 조언을 제공하지 않습니다.
      </p>
      <p>
        서비스에 게시된 모든 콘텐츠는 학술 연구 정보 제공을 목적으로 합니다.
        특정 환자의 진단, 치료, 예방에 관한 의료적 판단을 대체하지 않으며,
        의료 전문가의 직접적인 진료를 대신하지 않습니다. 건강 관련
        결정은 반드시 담당 의료 전문가와 상의하시기 바랍니다.
      </p>
      <Link
        href="/terms"
        className="mt-2 inline-block text-blue-600 hover:underline dark:text-blue-400"
      >
        이용약관
      </Link>
    </div>
  );
}
