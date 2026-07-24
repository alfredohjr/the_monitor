import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from '../app/register/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('Register page', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as { fetch?: unknown }).fetch;
  });

  it('renders an email field', () => {
    const { container } = render(<RegisterPage />);
    const email = container.querySelector('input[name="email"]') as HTMLInputElement;
    expect(email).toBeInTheDocument();
    expect(email.type).toBe('email');
  });

  it('renders organization and access-code fields', () => {
    const { container } = render(<RegisterPage />);
    expect(container.querySelector('input[name="organizacao"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="codigo"]')).toBeInTheDocument();
  });

  it('sends email, organization and access code in the registration payload', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    (global as { fetch: unknown }).fetch = fetchMock;

    const { container } = render(<RegisterPage />);

    fireEvent.change(container.querySelector('input[name="username"]')!, { target: { value: 'alfredo' } });
    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'a@example.com' } });
    fireEvent.change(container.querySelector('input[name="organizacao"]')!, { target: { value: 'Acme' } });
    fireEvent.change(container.querySelector('input[name="codigo"]')!, { target: { value: 'chave-acme' } });
    fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: 'senha123' } });
    fireEvent.change(container.querySelector('input[name="confirm"]')!, { target: { value: 'senha123' } });

    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.email).toBe('a@example.com');
    expect(body.organizacao).toBe('Acme');
    expect(body.codigo_organizacao).toBe('chave-acme');
  });

  it('mostra/oculta a senha ao clicar no olho (#241)', () => {
    const { container } = render(<RegisterPage />);
    const password = container.querySelector('input[name="password"]') as HTMLInputElement;
    const confirm = container.querySelector('input[name="confirm"]') as HTMLInputElement;
    // começa oculto
    expect(password.type).toBe('password');
    expect(confirm.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: /mostrar senha/i }));
    // o mesmo toggle revela os dois campos
    expect(password.type).toBe('text');
    expect(confirm.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: /ocultar senha/i }));
    expect(password.type).toBe('password');
    expect(confirm.type).toBe('password');
  });
});
