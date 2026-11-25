export type CostingLine = { supplier: string; quantity: string; unitPrice: string };
export type Costing = {
  currency: "USD" | "VES";
  lines: CostingLine[];
  chargeLabel: string;
  chargePercent: string;
  profitPercent: string;
};

export const MAX_COSTING_LINES = 50;
export const MAX_COSTING_LABEL_LENGTH = 120;
const MAX_AMOUNT_CENTS = 99_999_999_999_999n;

function scaledDecimal(raw: string, decimals: number): bigint | null {
  const input = raw.trim();
  if (input.length > 20) return null;
  const localized = /^(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(input);
  const normalized = localized ? input.replaceAll(".", "").replace(",", ".") : input;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) return null;
  return BigInt(match[1] + fraction.padEnd(decimals, "0"));
}

// Se redondea cada línea a céntimos antes de sumarla al subtotal.
export function costingLineCents(line: CostingLine) {
  const quantity = scaledDecimal(line.quantity, 3);
  const unitCents = scaledDecimal(line.unitPrice, 2);
  if (quantity === null || quantity === 0n || unitCents === null) return null;
  const cents = (quantity * unitCents + 500n) / 1000n;
  return cents <= MAX_AMOUNT_CENTS ? cents : null;
}

export function calculateCosting(costing: Costing) {
  if (costing.lines.length === 0 || costing.lines.length > MAX_COSTING_LINES) {
    return { error: `Agrega entre 1 y ${MAX_COSTING_LINES} proveedores.` };
  }

  let subtotal = 0n;
  for (const [index, line] of costing.lines.entries()) {
    if (!line.supplier.trim() || line.supplier.length > MAX_COSTING_LABEL_LENGTH) {
      return { error: `Escribe el proveedor de la línea ${index + 1}.` };
    }
    const cents = costingLineCents(line);
    if (cents === null) return { error: `Revisa la cantidad y el precio unitario de la línea ${index + 1}.` };
    subtotal += cents;
  }

  const chargeRate = scaledDecimal(costing.chargePercent.trim() || "0", 2);
  const profitRate = scaledDecimal(costing.profitPercent.trim() || "0", 2);
  if (chargeRate === null || profitRate === null) return { error: "Escribe los porcentajes con hasta dos decimales." };
  if (costing.chargeLabel.length > MAX_COSTING_LABEL_LENGTH || (chargeRate > 0n && !costing.chargeLabel.trim())) {
    return { error: "Escribe el concepto del cargo adicional." };
  }
  const charge = (subtotal * chargeRate + 5000n) / 10000n;
  const profit = (subtotal * profitRate + 5000n) / 10000n;
  const total = subtotal + charge + profit;
  if (total > MAX_AMOUNT_CENTS) return { error: "El total excede el monto máximo admitido." };

  return { subtotal: Number(subtotal) / 100, charge: Number(charge) / 100, profit: Number(profit) / 100, total: Number(total) / 100 };
}
