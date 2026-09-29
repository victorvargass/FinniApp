import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPeriodCsv } from '../lib/period-csv.ts';

const labels = {
  headers: {
    date: 'Fecha', time: 'Hora', type: 'Tipo', name: 'Nombre',
    category: 'Categoría', paymentMethod: 'Medio de pago', amount: 'Monto',
  },
  expense: 'Gasto',
  income: 'Ingreso',
  uncategorized: 'Sin categoría',
  noPaymentMethod: 'Sin medio de pago',
};

test('period CSV orders movements and escapes spreadsheet-sensitive separators', () => {
  const csv = buildPeriodCsv({
    expenses: [{
      id: 2, name: 'Compra; "hogar"', amount: 4500, originalAmount: 6000,
      date: '2026-09-12', time: '18:30', categoryName: 'Casa', paymentMethodName: 'Débito',
    }],
    incomes: [{
      id: 1, name: '=Sueldo', amount: 200000, date: '2026-09-05', time: '09:00',
      categoryName: null, paymentMethodName: null,
    }],
  }, ['date', 'time', 'type', 'name', 'amount'], labels);

  assert.ok(csv.startsWith('\uFEFFFecha;Hora;Tipo;Nombre;Monto\r\n'));
  assert.match(csv, /2026-09-05;09:00;Ingreso;'=Sueldo;200000/);
  assert.match(csv, /2026-09-12;18:30;Gasto;"Compra; ""hogar""";-6000/);
  assert.ok(csv.indexOf('Sueldo') < csv.indexOf('Compra'));
});

test('period CSV falls back to every field when selection is empty', () => {
  const csv = buildPeriodCsv({ expenses: [], incomes: [] }, [], labels);
  assert.match(csv, /^\uFEFFFecha;Hora;Tipo;Nombre;Categoría;Medio de pago;Monto/);
});
