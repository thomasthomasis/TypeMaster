/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_NAKAMA_HOST: string
    readonly VITE_NAKAMA_PORT: string
    readonly VITE_NAKAMA_SSL: string
    readonly VITE_NAKAMA_SERVER_KEY: string
    readonly VITE_NAKAMA_HTTP_KEY: string
    readonly VITE_DISCORD_CLIENT_ID: string
    readonly VITE_DISCORD_REDIRECT_URI: string
}

interface ImportMeta {
    readonly end: ImportMetaEnv
}