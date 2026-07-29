// Barril do catálogo pt-BR. Espelha en/index.ts — toda área acrescentada lá
// precisa existir aqui (o teste de paridade de chaves cobre isso).
import { auth } from "./auth";
import { comum } from "./comum";
import { goals } from "./goals";
import { goalsAnchor } from "./goalsAnchor";
import { goalsClone } from "./goalsClone";
import { goalsImport } from "./goalsImport";
import { landing } from "./landing";
import { layout } from "./layout";
import { login } from "./login";
import { metrics } from "./metrics";
import { onboarding } from "./onboarding";
import { register } from "./register";
import { navbar } from "./navbar";

export const ptBR = {
  auth,
  comum,
  goals,
  goalsAnchor,
  goalsClone,
  goalsImport,
  landing,
  layout,
  login,
  metrics,
  onboarding,
  register,
  navbar,
};
