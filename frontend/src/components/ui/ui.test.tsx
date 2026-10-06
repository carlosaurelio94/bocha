import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from './Badge';
import { Button, LinkButton } from './Button';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import { PageHeader } from './PageHeader';
import { Input } from './Input';
import { Select } from './Select';
import { Users } from 'lucide-react';

describe('Badge', () => {
  it.each([
    ['draft', 'Borrador'], ['sent', 'Enviado'], ['approved', 'Aprobado'],
    ['rejected', 'Rechazado'], ['prospect', 'Prospecto'], ['client', 'Cliente'],
  ] as const)('%s → "%s"', (variant, label) => {
    render(<Badge variant={variant} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('dispara onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('queda deshabilitado mientras carga', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Guardar</Button>);
    const btn = screen.getByRole('button', { name: 'Guardar' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('aplica la variante pedida', () => {
    render(<Button variant="danger">Borrar</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-red-600');
  });
});

describe('LinkButton', () => {
  it('renderiza un link (no un botón dentro de un link)', () => {
    render(<LinkButton href="/quotes/new">Nuevo</LinkButton>);
    const link = screen.getByRole('link', { name: 'Nuevo' });
    expect(link).toHaveAttribute('href', '/quotes/new');
    expect(link.querySelector('button')).toBeNull();
  });
});

describe('Avatar', () => {
  it.each([
    ['Carlos García', 'CG'],
    ['ana', 'A'],
    ['Jardines del Este C.A.', 'JD'],
    ['  María   López  ', 'ML'],
    ['', '?'],
  ])('"%s" → %s', (name, initials) => {
    render(<Avatar name={name} />);
    expect(screen.getByText(initials)).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('muestra título, descripción y acción', () => {
    render(<EmptyState icon={Users} title="Sin clientes" description="Creá uno" action={<button>Crear</button>} />);
    expect(screen.getByText('Sin clientes')).toBeInTheDocument();
    expect(screen.getByText('Creá uno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();
  });
});

describe('PageHeader', () => {
  it('muestra el título como h1 y las acciones', () => {
    render(<PageHeader title="Clientes" description="6 registros" actions={<button>Nuevo</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByText('6 registros')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeInTheDocument();
  });

  it('incluye link de volver solo si se pasa backHref', () => {
    const { rerender } = render(<PageHeader title="X" />);
    expect(screen.queryByRole('link', { name: 'Volver' })).toBeNull();
    rerender(<PageHeader title="X" backHref="/quotes" />);
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/quotes');
  });
});

describe('Input / Select', () => {
  it('Input asocia label, marca requerido y muestra error', () => {
    render(<Input label="Nombre" required error="Mínimo 2 caracteres" />);
    expect(screen.getByLabelText(/Nombre/)).toBeRequired();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('Mínimo 2 caracteres')).toBeInTheDocument();
  });

  it('Input muestra hint solo si no hay error', () => {
    const { rerender } = render(<Input label="N°" hint="Se completa solo" />);
    expect(screen.getByText('Se completa solo')).toBeInTheDocument();
    rerender(<Input label="N°" hint="Se completa solo" error="Requerido" />);
    expect(screen.queryByText('Se completa solo')).toBeNull();
  });

  it('Select asocia label y opciones', async () => {
    render(<Select label="Moneda"><option value="$">Dólar</option><option value="Bs">Bolívares</option></Select>);
    const select = screen.getByLabelText('Moneda');
    await userEvent.selectOptions(select, 'Bs');
    expect(select).toHaveValue('Bs');
  });
});
