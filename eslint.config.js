import { defineConfig } from '@king3/eslint-config'

export default defineConfig(
  {
    typescript: true
  },
  {
    files: ['**/*.md'],
    rules: {
      'import/first': 'off'
    }
  }
)
