// Versão da aplicação (SemVer). Reflete o que foi realmente buildado: o CI
// injeta NEXT_PUBLIC_APP_VERSION como build-arg (a tag do release, ex.: "0.4.0")
// e o Next inlina no bundle. Sem build-arg (dev local) cai no default "-dev".
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.4.0";
