import { render, screen } from '@testing-library/react';
import VersionBadge from '@/components/layout/VersionBadge';

test('mostra a versão do app com prefixo v', () => {
  render(<VersionBadge />);
  // usa APP_VERSION (default de dev "0.4.0" quando NEXT_PUBLIC_APP_VERSION ausente)
  expect(screen.getByText(/^v\d+\.\d+\.\d+/)).toBeInTheDocument();
});

test('não bloqueia cliques (pointer-events-none)', () => {
  render(<VersionBadge />);
  expect(screen.getByTestId('version-badge').className).toMatch(/pointer-events-none/);
});
