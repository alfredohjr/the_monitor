// Catálogo do onboarding: passo 1 cria a organização (quem entrou sem nenhuma,
// típico do login por Google), passo 2 escolhe as métricas a acompanhar.
export const onboarding = {
  // Passo 1 — organização
  welcomeTitle: "Welcome! Let's get started",
  welcomeSubtitle: "Create your organization to start tracking your metrics.",
  yourNameLabel: "Your name",
  yourNamePlaceholder: "How you want to be called",
  orgNameLabel: "Organization name",
  orgNamePlaceholder: "e.g. My Store",
  orgNameRequired: "Give your organization a name",
  createOrg: "Create organization",
  creatingOrg: "Creating…",
  createOrgFailed: "Could not create the organization.",

  // Passo 2 — métricas
  stepsTitle: "First steps",
  stepsSubtitle: "Pick the metrics you want to track. You can change this later.",
  // O nome e a descrição de cada métrica vêm do banco e continuam como foram
  // semeados — é dado, e o catálogo semeado é tratado no #317.
  noDefaultMetrics: "No default metrics available.",
  start: "Start",
  settingUp: "Setting up…",
  skip: "Skip",
};
