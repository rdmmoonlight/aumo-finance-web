import { defineConfig } from 'orval'

export default defineConfig({
  aumo: {
    input: {
      // 1. URL Swagger dari BE kamu. Ganti pas deploy
      target: 'https://aumonext-api.onrender.com/swagger/v1/swagger.json',
      // kalau udah deploy: 'https://api.aumo.com/swagger/v1/swagger.json'
    },
    output: {
      // 2. Hasil generate taruh sini
      target: './app/api/generated.ts',
      client: 'axios', // pake axios yg udah kita set di api-client.ts
      mock: false, // gak perlu mock dulu
      prettier: true, // auto rapihin code
      
      // 3. Yang paling penting: pake apiClient kita
      httpClient: 'axios',
      baseUrl: 'import.meta.env.WEB_API_BASE_URL',
      headers: true, // biar bisa kirim token cookie

      // 4. Bikin React Query hooks otomatis
      override: {
        mutator: {
          path: './app/lib/api-client.ts', // <-- pake apiClient jangkar kita
          name: 'apiClient'
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: false
        }
      }
    }
  }
})
