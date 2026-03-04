export function Footer() {
  return (
    <footer className="border-t border-gray-200 py-6 dark:border-gray-800">
      <div className="mx-auto max-w-[1280px] px-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          Data sourced from{" "}
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
        </p>
      </div>
    </footer>
  );
}
