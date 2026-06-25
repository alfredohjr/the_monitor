import { Y_AXIS_WIDTH, Y_AXIS_TICK_DX } from '@/lib/chart';

describe('dashboard chart Y axis config (issue #28)', () => {
  it('reserves enough width for multi-digit labels (no left clipping)', () => {
    // 40px nao cabe numeros de 3+ digitos; precisa de folga.
    expect(Y_AXIS_WIDTH).toBeGreaterThanOrEqual(48);
  });

  it('does not shift tick labels off the left edge', () => {
    // dx negativo empurrava os rotulos para fora da area visivel.
    expect(Y_AXIS_TICK_DX).toBeGreaterThanOrEqual(0);
  });
});
