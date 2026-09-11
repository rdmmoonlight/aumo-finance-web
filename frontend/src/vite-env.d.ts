/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WEB_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
