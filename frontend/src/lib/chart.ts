// Configuração compartilhada dos gráficos do dashboard.
//
// Issue #28: os números do eixo Y apareciam cortados na borda esquerda.
// Causa: a largura reservada (40px) não cabia números de 3+ dígitos e o
// deslocamento `dx={-10}` empurrava os rótulos para fora da área visível.
export const Y_AXIS_WIDTH = 48;
export const Y_AXIS_TICK_DX = 0;
