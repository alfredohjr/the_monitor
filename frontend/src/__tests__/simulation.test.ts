import { replicateForward, ReplicableBar } from '@/lib/simulation';

// Helper: monta barras a partir de valores; locked opcional por indice.
function bars(values: number[], lockedIdx: number[] = []): ReplicableBar[] {
  return values.map((alvo, i) => ({ alvo, isLockedRegion: lockedIdx.includes(i) }));
}

describe('replicateForward (issue #31)', () => {
  it('propaga o valor da barra editada para todas as barras a direita', () => {
    // editou a 3a posicao (indice 2) para 1, depois clicou em replicar
    expect(replicateForward(bars([0, 0, 1, 0, 0]), 2, false)).toEqual([0, 0, 1, 1, 1]);
  });

  it('uma edicao mais a direita re-propaga dali, preservando as anteriores', () => {
    // estado [0,0,1,1,1] -> editou a 4a (indice 3) para 4 -> [0,0,1,4,1] -> replicar
    expect(replicateForward(bars([0, 0, 1, 4, 1]), 3, false)).toEqual([0, 0, 1, 4, 4]);
  });

  it('nao altera as barras a esquerda nem a propria barra de origem', () => {
    expect(replicateForward(bars([5, 8, 3, 0, 0]), 2, false)).toEqual([5, 8, 3, 3, 3]);
  });

  it('respeita barras bloqueadas quando lockHistorical esta ligado', () => {
    // indice 3 bloqueado: mantem o valor original mesmo apos a origem
    expect(replicateForward(bars([1, 0, 0, 9, 0], [3]), 1, true)).toEqual([1, 0, 0, 9, 0]);
  });

  it('ignora o bloqueio quando lockHistorical esta desligado', () => {
    expect(replicateForward(bars([1, 0, 0, 9, 0], [3]), 1, false)).toEqual([1, 0, 0, 0, 0]);
  });

  it('nao faz nada quando a origem e a ultima barra', () => {
    expect(replicateForward(bars([1, 2, 3]), 2, false)).toEqual([1, 2, 3]);
  });

  it('retorna os valores inalterados para indice invalido', () => {
    expect(replicateForward(bars([1, 2, 3]), -1, false)).toEqual([1, 2, 3]);
    expect(replicateForward(bars([1, 2, 3]), 9, false)).toEqual([1, 2, 3]);
  });
});
