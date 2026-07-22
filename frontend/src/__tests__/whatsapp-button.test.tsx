import { render, screen } from '@testing-library/react';
import WhatsAppButton from '@/components/layout/WhatsAppButton';

test('renderiza link de contato para o WhatsApp correto', () => {
  render(<WhatsAppButton />);
  const link = screen.getByRole('link', { name: /whatsapp|contato/i });
  expect(link).toHaveAttribute('href', 'https://wa.me/5541992742046');
});

test('abre em nova aba com rel seguro', () => {
  render(<WhatsAppButton />);
  const link = screen.getByRole('link', { name: /whatsapp|contato/i });
  expect(link).toHaveAttribute('target', '_blank');
  expect(link.getAttribute('rel') ?? '').toMatch(/noopener/);
});
