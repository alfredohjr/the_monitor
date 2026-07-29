// Barril do catálogo em inglês. Cada issue de tela acrescenta AQUI uma linha de
// import e uma entrada no objeto — duas linhas por área, de propósito: é a menor
// superfície de conflito possível entre PRs que rodam em sequência.
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

export const en = {
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
