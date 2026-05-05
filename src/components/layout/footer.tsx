import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 py-6 dark:border-gray-800">
      <div className="mx-auto max-w-[1280px] space-y-3 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <nav className="flex items-center justify-center gap-4">
          <Link
            href="/about"
            className="transition-colors hover:text-gray-700 dark:hover:text-gray-200"
          >
            About
          </Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <Link
            href="/privacy"
            className="transition-colors hover:text-gray-700 dark:hover:text-gray-200"
          >
            Privacy
          </Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <Link
            href="/terms"
            className="transition-colors hover:text-gray-700 dark:hover:text-gray-200"
          >
            Terms
          </Link>
        </nav>
        <p>
          Paper metadata sourced from{" "}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            PubMed
          </a>{" "}
          and{" "}
          <a
            href="https://www.crossref.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            CrossRef
          </a>
          . AI analysis and curation by My Allergy.
        </p>
      </div>
    </footer>
  );
}
