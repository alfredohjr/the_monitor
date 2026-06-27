export interface ReplicableBar {
  alvo: number;
  isLockedRegion: boolean;
}

/**
 * Replica o valor da barra em `fromIndex` para todas as barras à direita dela
 * (issue #31). As barras à esquerda e a própria barra de origem ficam
 * intactas. Quando `lockHistorical` está ligado, barras bloqueadas
 * (`isLockedRegion`) preservam o valor original.
 *
 * Retorna a nova lista de valores (`alvo`), na mesma ordem.
 */
export function replicateForward(
  bars: ReplicableBar[],
  fromIndex: number,
  lockHistorical: boolean,
): number[] {
  if (fromIndex < 0 || fromIndex >= bars.length) {
    return bars.map((b) => b.alvo);
  }
  const value = bars[fromIndex].alvo;
  return bars.map((b, i) => {
    if (i <= fromIndex) return b.alvo;
    if (lockHistorical && b.isLockedRegion) return b.alvo;
    return value;
  });
}
