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
