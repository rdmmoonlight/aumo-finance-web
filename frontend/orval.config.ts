import { defineConfig } from 'orval'

export default defineConfig({
  aumo: {
    input: {
      target: 'https://aumonext-api.onrender.com/swagger/v1/swagger.json',
    },
    output: {
      mode: 'tags-split',
      target: './app/api/generated/endpoints',
      schemas: './app/api/generated/models',
      client: 'react-query',
      mock: false,
      prettier: true,
      override: {
        mutator: {
          path: './src/lib/apiClient.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: false,
        },
      },
    },
  },
})