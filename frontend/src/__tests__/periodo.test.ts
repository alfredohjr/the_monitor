import { bucketKey, getWeekPattern } from "@/lib/periodo";

describe("bucketKey", () => {
  it("daily: mantém a data completa", () => {
    expect(bucketKey("2026-07-15", "daily")).toBe("2026-07-15");
  });

  it("monthly: reduz para ano-mês", () => {
    expect(bucketKey("2026-07-15", "monthly")).toBe("2026-07");
  });

  it("yearly: reduz para o ano", () => {
    expect(bucketKey("2026-07-15", "yearly")).toBe("2026");
  });

  it("weekly: usa o padrão de semana ISO", () => {
    // 2026-07-15 é uma quarta-feira -> semana ISO 29 de 2026.
    expect(bucketKey("2026-07-15", "weekly")).toBe(getWeekPattern(new Date(2026, 6, 15)));
    expect(bucketKey("2026-07-15", "weekly")).toMatch(/^2026-W\d{2}$/);
  });

  it("período desconhecido cai no comportamento diário", () => {
    expect(bucketKey("2026-07-15", "qualquer")).toBe("2026-07-15");
  });

  it("bucket bate com o formato do input week do GoalForm", () => {
    // Dias da mesma semana ISO devem gerar a mesma chave.
    const seg = bucketKey("2026-07-13", "weekly");
    const dom = bucketKey("2026-07-19", "weekly");
    expect(seg).toBe(dom);
  });
});

// --- formatação por locale (#310) ---

import { formatData, formatNumero } from '@/lib/formatValor';

describe('formatData — exibição por locale', () => {
  afterEach(() => localStorage.clear());

  it('usa o formato do locale ativo', () => {
    expect(formatData('2026-07-29T10:00:00Z')).toBe('7/29/2026');
    localStorage.setItem('locale', 'pt-BR');
    expect(formatData('2026-07-29T10:00:00Z')).toBe('29/07/2026');
  });

  it('devolve o valor cru se a data for inválida, em vez de "Invalid Date"', () => {
    expect(formatData('nao-e-data')).toBe('nao-e-data');
    expect(formatData('')).toBe('');
  });
});

describe('formatNumero — exibição por locale', () => {
  afterEach(() => localStorage.clear());

  it('usa o separador do locale ativo', () => {
    expect(formatNumero(1234.5)).toBe('1,234.50');
    localStorage.setItem('locale', 'pt-BR');
    expect(formatNumero(1234.5)).toBe('1.234,50');
  });

  it('NaN vira zero formatado no locale, não "0,00" cravado', () => {
    expect(formatNumero(NaN)).toBe('0.00');
    localStorage.setItem('locale', 'pt-BR');
    expect(formatNumero(NaN)).toBe('0,00');
  });
});

describe('bucketKey — o formato de DADO não muda com o idioma (#310)', () => {
  afterEach(() => localStorage.clear());

  it('devolve ISO nos dois idiomas', () => {
    // bucketKey casa meta com lançamento e bate com o <input type="week">.
    // Se ele acompanhasse o locale, o pareamento quebraria silenciosamente:
    // a meta continuaria lá, só não seria mais encontrada.
    const emIngles = ['daily', 'weekly', 'monthly', 'yearly'].map(p => bucketKey('2026-07-29', p));
    localStorage.setItem('locale', 'pt-BR');
    const emPortugues = ['daily', 'weekly', 'monthly', 'yearly'].map(p => bucketKey('2026-07-29', p));
    expect(emPortugues).toEqual(emIngles);
    expect(emIngles).toEqual(['2026-07-29', '2026-W31', '2026-07', '2026']);
  });
});
