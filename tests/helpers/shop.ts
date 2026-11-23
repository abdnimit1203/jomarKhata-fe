/** A small but realistic shop: every record type, edits and voids included (shared by tests). */
import type { App } from './app';

export async function buildRealisticShop(app: App) {
  const cust = await app.service.createParty({ name: 'করিম স্টোর', phone: '01711000000', role: 'customer', openingDue: 500 });
  const sup = await app.service.createParty({ name: 'ঢাকা ট্রেডার্স', phone: '01811000000', role: 'supplier' });
  const prod = await app.service.createProduct({
    name: 'সয়াবিন তেল ১ লি.', category: 'মুদি', unit: 'বোতল', purchasePrice: 170, sellingPrice: 190, stockQty: 0, lowStockThreshold: 4,
  });
  await app.service.createPurchase({
    mode: 'product', partyId: sup.id, paymentMethod: 'cash', paidAmount: 1000,
    items: [{ productId: prod.id, name: prod.name, unit: 'বোতল', qty: 12, unitPrice: 170, lineTotal: 2040 }],
  });
  const sale = await app.service.createSale({
    mode: 'product', partyId: cust.id, paymentMethod: 'bkash', paidAmount: 200,
    items: [{ productId: prod.id, name: prod.name, unit: 'বোতল', qty: 3, unitPrice: 190, unitCostSnapshot: 170, lineTotal: 570 }],
  });
  const walkIn = await app.service.createSale({
    mode: 'quick', paymentMethod: 'cash', paidAmount: 120,
    items: [{ productId: null, name: 'বিস্কুট', qty: 1, unitPrice: 120, unitCostSnapshot: null, lineTotal: 120 }],
  });
  await app.service.recordDueEntry({ partyId: cust.id, entryType: 'customer_collection', amount: 300, paymentMethod: 'cash' });
  await app.service.recordDueEntry({ partyId: sup.id, entryType: 'supplier_payment', amount: 500 });
  const exp = await app.service.createExpense({ category: 'ভাড়া', title: 'দোকান ভাড়া', amount: 3000, paymentMethod: 'cash' });
  await app.service.adjustProductStock(prod.id, -1, 'ভাঙা বোতল');
  await app.service.editSale(walkIn.id, {
    mode: 'quick', paymentMethod: 'cash', paidAmount: 150,
    items: [{ productId: null, name: 'বিস্কুট', qty: 1, unitPrice: 150, unitCostSnapshot: null, lineTotal: 150 }],
  });
  await app.service.voidExpense(exp.id, 'ভুল এন্ট্রি');
  return { cust, sup, prod, sale };
}
