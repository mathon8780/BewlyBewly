import antfu from '@antfu/eslint-config'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

export default antfu(
  {
    formatters: {
      css: 'prettier',
      prettierOptions: {
        printWidth: 120,
        singleQuote: false,
      },
    },
    rules: {
      'vue/max-attributes-per-line': [
        'error',
        {
          singleline: {
            max: 5,
          },
          multiline: {
            max: 5,
          },
        },
      ],
      'no-alert': 'off',
      'style/quote-props': 'off',
      'ts/no-unsafe-function-type': 'off',
      'vue/custom-event-name-casing': 'off',
    },
  },
  { ignores: ['**/.planning/**', '**/.pnpm-store/**', 'dist/**', 'public/**', 'extension/**', 'extension-firefox/**', 'extension-safari/**'] },
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'import/order': 'off',
      'sort-imports': 'off',
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
)
