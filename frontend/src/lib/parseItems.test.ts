import { describe, it, expect } from 'vitest';
import { parseItemsText } from './parseItems';

describe('parseItemsText', () => {
  it('parsea "cantidad producto precio" y calcula el total', () => {
    expect(parseItemsText('3 pandanus 2.5')).toEqual([
      { quantity: 3, product: 'pandanus', unit_price: 2.5, total_price: 7.5 },
    ]);
  });

  it('acepta productos con varias palabras y números en el medio', () => {
    expect(parseItemsText('5 metros 2x5 50')).toEqual([
      { quantity: 5, product: 'metros 2x5', unit_price: 50, total_price: 250 },
    ]);
  });

  it('procesa varias líneas e ignora las vacías y los espacios extra', () => {
    const items = parseItemsText('  1 ficus 150  \n\n   \n2   palma   areca   30\n');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ product: 'ficus', total_price: 150 });
    expect(items[1]).toMatchObject({ product: 'palma areca', quantity: 2, total_price: 60 });
  });

  it('descarta líneas con menos de tres tokens', () => {
    expect(parseItemsText('ficus 150\n3 ficus')).toEqual([]);
  });

  it('descarta líneas donde cantidad o precio no son números', () => {
    expect(parseItemsText('tres ficus 150\n3 ficus caro')).toEqual([]);
  });

  it('mantiene las líneas válidas aunque haya inválidas en el medio', () => {
    const items = parseItemsText('1 ficus 10\nbasura\n2 cactus 5');
    expect(items.map((i) => i.product)).toEqual(['ficus', 'cactus']);
  });

  it('acepta decimales en la cantidad', () => {
    expect(parseItemsText('1.5 tierra 4')[0]).toMatchObject({ quantity: 1.5, total_price: 6 });
  });

  it('devuelve vacío para texto vacío', () => {
    expect(parseItemsText('')).toEqual([]);
  });
});
