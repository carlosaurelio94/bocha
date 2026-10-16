// ─── Parser de texto libre ────────────────────────────────────────────────────
// Formato: "cantidad nombre_del_producto precio"
// Ejemplo: "3 pandanus 2.5" → { quantity: 3, product: "pandanus", unit_price: 2.5 }
export interface ParsedItem {
  quantity:    number;
  product:     string;
  unit_price:  number;
  total_price: number;
}

export function parseItemsText(text: string): ParsedItem[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .flatMap(line => {
      const tokens = line.split(/\s+/);
      if (tokens.length < 3) return [];

      const quantity  = parseFloat(tokens[0]);
      const unitPrice = parseFloat(tokens[tokens.length - 1]);

      if (isNaN(quantity) || isNaN(unitPrice)) return [];

      const product = tokens.slice(1, -1).join(' ');
      if (!product) return [];

      return [{ quantity, product, unit_price: unitPrice, total_price: quantity * unitPrice }];
    });
}
