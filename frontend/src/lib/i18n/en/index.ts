// Barril do catálogo em inglês. Cada issue de tela acrescenta AQUI uma linha de
// import e uma entrada no objeto — duas linhas por área, de propósito: é a menor
// superfície de conflito possível entre PRs que rodam em sequência.
import { auth } from "./auth";
import { comum } from "./comum";
import { landing } from "./landing";
import { layout } from "./layout";
import { login } from "./login";
import { register } from "./register";
import { navbar } from "./navbar";

export const en = {
  auth,
  comum,
  landing,
  layout,
  login,
  register,
  navbar,
};
