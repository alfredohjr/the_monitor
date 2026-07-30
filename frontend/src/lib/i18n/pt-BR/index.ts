// Barril do catálogo pt-BR. Espelha en/index.ts — toda área acrescentada lá
// precisa existir aqui (o teste de paridade de chaves cobre isso).
import { auth } from "./auth";
import { comum } from "./comum";
import { dashboard } from "./dashboard";
import { goals } from "./goals";
import { goalsAnchor } from "./goalsAnchor";
import { goalsClone } from "./goalsClone";
import { goalsImport } from "./goalsImport";
import { landing } from "./landing";
import { layout } from "./layout";
import { logs } from "./logs";
import { logsImport } from "./logsImport";
import { login } from "./login";
import { metrics } from "./metrics";
import { onboarding } from "./onboarding";
import { register } from "./register";
import { simulation } from "./simulation";
import { navbar } from "./navbar";

export const ptBR = {
  auth,
  comum,
  dashboard,
  goals,
  goalsAnchor,
  goalsClone,
  goalsImport,
  landing,
  layout,
  logs,
  logsImport,
  login,
  metrics,
  onboarding,
  register,
  simulation,
  navbar,
};
