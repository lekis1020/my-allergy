import coreWebVitals from 'eslint-config-next/core-web-vitals'

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ['**/.DS_Store', '**/._*', '.next/**', 'node_modules/**'],
  },
  ...coreWebVitals,
  {
    rules: {
      // Downgrade to warning — pre-existing patterns; will be cleaned up in a separate PR.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]

export default config
