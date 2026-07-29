// Catálogo da landing page. O título é partido em duas chaves porque a segunda
// parte vai dentro de um <span> com gradiente — juntar viraria interpolação de
// JSX, que o `t()` não faz.
export const landing = {
  heroTitle: "Total Control of Your",
  heroTitleAccent: "Progress",
  subtitle:
    "Your control center to measure metrics, set challenges and record your wins. Jump into the areas below.",
  // Os títulos em pt-BR trazem o termo em inglês entre parênteses ("Criar
  // Desafio (Goals)"); em inglês o parêntese seria repetição, então sai.
  dashboardTitle: "1. Dashboard",
  dashboardText:
    "Follow the full statistics, see the week's progress charts and the goal success rate.",
  logsTitle: "2. Daily Check-in",
  logsText:
    "Just got something done? Record the value here, picking the goal and the day it counts for.",
  goalsTitle: "3. Create a Challenge",
  goalsText:
    "Tie one of your metrics to a fixed period and set what your target is.",
  metricsTitle: "4. Root Metric",
  metricsText:
    "What do you want to measure? Add the unit before we build a challenge on top of it.",
};
