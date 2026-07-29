// Barril do catálogo pt-BR. Espelha en/index.ts — toda área acrescentada lá
// precisa existir aqui (o teste de paridade de chaves cobre isso).
import { comum } from "./comum";
import { layout } from "./layout";
import { navbar } from "./navbar";

export const ptBR = {
  comum,
  layout,
  navbar,
};
