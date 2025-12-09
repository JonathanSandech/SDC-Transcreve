/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // adicione mais variáveis de ambiente aqui se precisar
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}