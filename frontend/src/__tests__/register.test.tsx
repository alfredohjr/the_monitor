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

  it('sends the email in the registration payload', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    (global as { fetch: unknown }).fetch = fetchMock;

    const { container } = render(<RegisterPage />);

    fireEvent.change(container.querySelector('input[name="username"]')!, { target: { value: 'alfredo' } });
    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'a@example.com' } });
    fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: 'senha123' } });
    fireEvent.change(container.querySelector('input[name="confirm"]')!, { target: { value: 'senha123' } });

    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.email).toBe('a@example.com');
  });
});
