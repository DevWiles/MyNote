/// <reference types="vite/client" />

/** 构建时注入的当前 commit 6 位短哈希（见 vite.config.ts） */
declare const __APP_COMMIT__: string;

/** 构建时注入的展示版本号（发布 Tag，见 vite.config.ts） */
declare const __APP_VERSION__: string;
