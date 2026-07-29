import { render, screen, fireEvent } from '@testing-library/react';
import CookieConsent from '@/components/layout/CookieConsent';

afterEach(() => {
  localStorage.clear();
});

describe('CookieConsent — aviso de cookies', () => {
  it('exibe o aviso quando ainda não houve consentimento', () => {
    render(<CookieConsent />);
    expect(screen.getByText(/cookies/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
  });

  it('ao aceitar, esconde o aviso e grava o consentimento', () => {
    render(<CookieConsent />);
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('cookie-consent')).toBe('true');
  });

  it('não exibe o aviso quando já houve consentimento', () => {
    localStorage.setItem('cookie-consent', 'true');
    render(<CookieConsent />);
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
  });
});

describe('CookieConsent — idioma (#280)', () => {
  it('renderiza em pt-BR quando o locale está salvo', () => {
    localStorage.setItem('locale', 'pt-BR');
    render(<CookieConsent />);
    expect(screen.getByRole('button', { name: /aceitar/i })).toBeInTheDocument();
    expect(screen.getByText(/usamos cookies/i)).toBeInTheDocument();
  });
});
