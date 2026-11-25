import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCosting, type Costing } from "./costing";

const costing: Costing = {
  currency: "USD",
  lines: [{ supplier: "Gabriel", quantity: "3", unitPrice: "7,50" }],
  chargeLabel: "Cargo adicional",
  chargePercent: "10",
  profitPercent: "20",
};

test("calcula los dos porcentajes sobre el subtotal de proveedores", () => {
  assert.deepEqual(calculateCosting(costing), { subtotal: 22.5, charge: 2.25, profit: 4.5, total: 29.25 });
});

test("redondea los importes de cada proveedor antes de sumar y calcular porcentajes", () => {
  const line = { supplier: "Proveedor", quantity: "0.5", unitPrice: "1.01" };
  assert.deepEqual(calculateCosting({ ...costing, lines: [line, line], chargePercent: "50", profitPercent: "0" }),
    { subtotal: 1.02, charge: 0.51, profit: 0, total: 1.53 });
});

test("acepta separadores locales y tasas fraccionarias", () => {
  const line = { supplier: "Proveedor", quantity: "1", unitPrice: "1.234,50" };
  assert.deepEqual(calculateCosting({ ...costing, lines: [line], chargePercent: "1,5", profitPercent: "" }),
    { subtotal: 1234.5, charge: 18.52, profit: 0, total: 1253.02 });
});

test("rechaza valores inválidos y exige un concepto para el cargo", () => {
  assert.ok(calculateCosting({ ...costing, lines: [{ ...costing.lines[0], quantity: "0" }] }).error);
  assert.ok(calculateCosting({ ...costing, chargeLabel: "" }).error);
  assert.ok(calculateCosting({ ...costing, profitPercent: "-1" }).error);
});
