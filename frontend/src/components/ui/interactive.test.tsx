import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Pagination } from './Pagination';
import { SearchInput } from './SearchInput';
import { FilterTabs } from './FilterTabs';
import { Modal } from './Modal';

describe('Pagination', () => {
  it('no se muestra si hay una sola página', () => {
    const { container } = render(<Pagination page={1} pageSize={15} total={10} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el rango visible y el total', () => {
    render(<Pagination page={2} pageSize={15} total={40} onChange={vi.fn()} />);
    expect(screen.getByText('16–30 de 40')).toBeInTheDocument();
  });

  it('el rango de la última página no se pasa del total', () => {
    render(<Pagination page={3} pageSize={15} total={40} onChange={vi.fn()} />);
    expect(screen.getByText('31–40 de 40')).toBeInTheDocument();
  });

  it('deshabilita "anterior" en la primera y "siguiente" en la última', () => {
    const { rerender } = render(<Pagination page={1} pageSize={10} total={25} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Página anterior')).toBeDisabled();
    expect(screen.getByLabelText('Página siguiente')).toBeEnabled();
    rerender(<Pagination page={3} pageSize={10} total={25} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Página siguiente')).toBeDisabled();
  });

  it('avisa la página nueva', async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} pageSize={10} total={25} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Página siguiente'));
    await userEvent.click(screen.getByLabelText('Página anterior'));
    expect(onChange.mock.calls).toEqual([[3], [1]]);
  });
});

describe('SearchInput', () => {
  function Controlled() {
    const [v, setV] = useState('');
    return <SearchInput value={v} onChange={setV} placeholder="Buscar" />;
  }

  it('escribe y limpia con la X', async () => {
    render(<Controlled />);
    const input = screen.getByPlaceholderText('Buscar');
    expect(screen.queryByLabelText('Limpiar búsqueda')).toBeNull();

    await userEvent.type(input, 'ana');
    expect(input).toHaveValue('ana');

    await userEvent.click(screen.getByLabelText('Limpiar búsqueda'));
    expect(input).toHaveValue('');
  });
});

describe('FilterTabs', () => {
  it('marca la opción activa y avisa el cambio', async () => {
    const onChange = vi.fn();
    render(
      <FilterTabs
        value="sent"
        onChange={onChange}
        options={[{ value: '', label: 'Todos' }, { value: 'sent', label: 'Sin respuesta' }]}
      />
    );
    expect(screen.getByRole('button', { name: 'Sin respuesta' })).toHaveClass('bg-gray-900');
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('Modal', () => {
  it('no renderiza nada cerrado', () => {
    render(<Modal open={false} onClose={vi.fn()} title="Hola">contenido</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('es un diálogo accesible con título y descripción', () => {
    render(<Modal open onClose={vi.fn()} title="Nuevo cliente" description="Solo el nombre es obligatorio">x</Modal>);
    expect(screen.getByRole('dialog', { name: 'Nuevo cliente' })).toBeInTheDocument();
    expect(screen.getByText('Solo el nombre es obligatorio')).toBeInTheDocument();
  });

  it('cierra con Escape, con la X y con click afuera, pero no con click adentro', async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="T"><p>adentro</p></Modal>);

    fireEvent.mouseDown(screen.getByText('adentro'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByLabelText('Cerrar'));
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('pone el foco en el primer campo y bloquea el scroll del body', () => {
    const { unmount } = render(<Modal open onClose={vi.fn()} title="T"><input aria-label="nombre" /><input aria-label="otro" /></Modal>);
    expect(screen.getByLabelText('nombre')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('con Tab el foco no se escapa del diálogo', async () => {
    render(
      <>
        <button>afuera</button>
        <Modal open onClose={vi.fn()} title="T"><input aria-label="campo" /><button>Guardar</button></Modal>
      </>
    );
    expect(screen.getByLabelText('campo')).toHaveFocus();
    // Orden dentro del diálogo: X (cerrar), campo, Guardar → al pasar el último vuelve al primero
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'afuera' })).not.toHaveFocus();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    await userEvent.tab({ shift: true });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('al cerrar, el foco vuelve al botón que lo abrió', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir</button>
          <Modal open={open} onClose={() => setOpen(false)} title="T">contenido</Modal>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(opener);
    expect(screen.getByRole('dialog')).toHaveFocus(); // sin campos, el foco va al diálogo
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });
});

describe('FilterTabs accesible', () => {
  it('marca la pestaña activa con aria-pressed', () => {
    render(<FilterTabs value="a" onChange={vi.fn()} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />);
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'B' })).toHaveAttribute('aria-pressed', 'false');
  });
});

