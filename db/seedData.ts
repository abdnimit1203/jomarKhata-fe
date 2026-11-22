import type {
  AuditLog,
  BusinessProfile,
  DueTransaction,
  ExpenseRecord,
  MoneyMovement,
  Party,
  Product,
  PurchaseRecord,
  SaleRecord,
  StockMovement,
} from '@/types/domain';

export interface SeedDataset {
  businessProfile: BusinessProfile;
  parties: Party[];
  products: Product[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  moneyMovements: MoneyMovement[];
  dueTransactions: DueTransaction[];
  expenses: ExpenseRecord[];
  stockMovements: StockMovement[];
  auditLogs: AuditLog[];
}

function isoDaysAgo(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function isoDaysAhead(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/**
 * Generates a canonically consistent generic Bangladeshi retail shop seed dataset.
 * Strictly obeys all 5 accounting invariants:
 * 1. Every actual cash/bKash/Nagad/bank inflow or outflow has ONE MoneyMovement record.
 * 2. Every unpaid sale/purchase has an assigned customer/supplier partyId.
 * 3. Includes both costed product sales and uncosted quick sales so honest profit completeness displays accurately.
 * 4. Party balances and running balances match active dueTransactions exactly.
 * 5. Includes append-only audit logs for created transactions.
 */
export function buildSeedDataset(): SeedDataset {
  const nowIso = new Date().toISOString();

  const businessProfile: BusinessProfile = {
    id: 'default',
    shopName: 'বিসমিল্লাহ জেনারেল স্টোর',
    ownerName: 'মোঃ রফিকুল ইসলাম',
    phone: '01712-458930',
    address: 'স্টেশন রোড, মিরপুর-১০, ঢাকা',
    businessType: 'মুদি ও সাধারণ খুচরা দোকান',
    openingBalances: {
      cash: 15000,
      bkash: 4200,
      nagad: 2500,
      bank: 12000,
    },
    defaultLowStockThreshold: 8,
    createdAt: isoDaysAgo(30, 9, 0),
    updatedAt: nowIso,
  };

  // Parties (Customers & Suppliers)
  const c1 = 'party-cust-kamrul';
  const c2 = 'party-cust-cha-dokan';
  const c3 = 'party-cust-imran';
  const c4 = 'party-cust-parvez';
  const c5 = 'party-cust-halim';
  const s1 = 'party-supp-dhaka-traders';
  const s2 = 'party-supp-alam-enterprise';

  const parties: Party[] = [
    {
      id: c1,
      name: 'কামরুল ইসলাম',
      phone: '+8801745436984',
      address: 'মুসাফির মোড়',
      role: 'customer',
      balance: 2400,
      dueReminderDate: isoDaysAhead(3),
      lastTransactionAt: isoDaysAgo(0, 11, 20),
      createdAt: isoDaysAgo(25, 10, 0),
      updatedAt: isoDaysAgo(0, 11, 20),
    },
    {
      id: c2,
      name: 'পিছনের চা দোকান',
      phone: '+8801817697590',
      address: 'বাজার গলি',
      role: 'customer',
      balance: 1750,
      dueReminderDate: isoDaysAhead(2),
      lastTransactionAt: isoDaysAgo(1, 16, 40),
      createdAt: isoDaysAgo(20, 10, 0),
      updatedAt: isoDaysAgo(1, 16, 40),
    },
    {
      id: c3,
      name: 'ইমরান হোসেন',
      phone: '+8801949123688',
      address: 'উত্তর পাড়া',
      role: 'customer',
      balance: 1300,
      dueReminderDate: null,
      lastTransactionAt: isoDaysAgo(2, 13, 15),
      createdAt: isoDaysAgo(18, 10, 0),
      updatedAt: isoDaysAgo(2, 13, 15),
    },
    {
      id: c4,
      name: 'পারভেজ মিয়া',
      phone: '+8801312945209',
      address: 'কলেজ গেট',
      role: 'customer',
      balance: 450,
      dueReminderDate: null,
      lastTransactionAt: isoDaysAgo(3, 18, 10),
      createdAt: isoDaysAgo(15, 10, 0),
      updatedAt: isoDaysAgo(3, 18, 10),
    },
    {
      id: c5,
      name: 'হালিম কাকা',
      phone: '+8801875133572',
      address: 'মসজিদ রোড',
      role: 'customer',
      balance: 0,
      dueReminderDate: null,
      lastTransactionAt: isoDaysAgo(4, 15, 0),
      createdAt: isoDaysAgo(14, 10, 0),
      updatedAt: isoDaysAgo(4, 15, 0),
    },
    {
      id: s1,
      name: 'ঢাকা হোলসেল ট্রেডার্স',
      phone: '+8801711223344',
      address: 'মৌলভীবাজার, ঢাকা',
      role: 'supplier',
      balance: -4500,
      dueReminderDate: isoDaysAhead(5),
      lastTransactionAt: isoDaysAgo(1, 10, 30),
      createdAt: isoDaysAgo(28, 9, 0),
      updatedAt: isoDaysAgo(1, 10, 30),
    },
    {
      id: s2,
      name: 'আলম এন্টারপ্রাইজ',
      phone: '+8801911556677',
      address: 'কারওয়ান বাজার',
      role: 'supplier',
      balance: -1800,
      dueReminderDate: null,
      lastTransactionAt: isoDaysAgo(3, 11, 0),
      createdAt: isoDaysAgo(26, 9, 0),
      updatedAt: isoDaysAgo(3, 11, 0),
    },
  ];

  // Optional Generic Retail Product Catalog
  const pRice = 'prod-miniket-rice';
  const pOil = 'prod-soybean-oil';
  const pSugar = 'prod-sugar';
  const pDal = 'prod-masoor-dal';
  const pTea = 'prod-tea-leaf';
  const pSoap = 'prod-soap';
  const pAtta = 'prod-atta';

  const products: Product[] = [
    {
      id: pRice,
      name: 'মিনিকেট চাল (১ কেজি)',
      category: 'মুদি ও খাদ্যসামগ্রী',
      unit: 'কেজি',
      purchasePrice: 66,
      sellingPrice: 74,
      stockQty: 48,
      lowStockThreshold: 15,
      isActive: true,
      createdAt: isoDaysAgo(25, 9, 0),
      updatedAt: isoDaysAgo(0, 11, 20),
    },
    {
      id: pOil,
      name: 'সয়াবিন তেল (২ লিটার)',
      category: 'তেল ও মসলা',
      unit: 'বোতল',
      purchasePrice: 318,
      sellingPrice: 340,
      stockQty: 14,
      lowStockThreshold: 8,
      isActive: true,
      createdAt: isoDaysAgo(25, 9, 0),
      updatedAt: isoDaysAgo(0, 14, 15),
    },
    {
      id: pSugar,
      name: 'সাদা চিনি (১ কেজি)',
      category: 'মুদি ও খাদ্যসামগ্রী',
      unit: 'কেজি',
      purchasePrice: 122,
      sellingPrice: 135,
      stockQty: 6,
      lowStockThreshold: 10,
      isActive: true,
      createdAt: isoDaysAgo(25, 9, 0),
      updatedAt: isoDaysAgo(1, 16, 40),
    },
    {
      id: pDal,
      name: 'মসুর ডাল (১ কেজি)',
      category: 'মুদি ও খাদ্যসামগ্রী',
      unit: 'কেজি',
      purchasePrice: 118,
      sellingPrice: 132,
      stockQty: 22,
      lowStockThreshold: 8,
      isActive: true,
      createdAt: isoDaysAgo(24, 9, 0),
      updatedAt: isoDaysAgo(1, 12, 0),
    },
    {
      id: pTea,
      name: 'চা পাতা (৪০০ গ্রাম)',
      category: 'পানীয় ও নাস্তা',
      unit: 'প্যাকেট',
      purchasePrice: 195,
      sellingPrice: 220,
      stockQty: 5,
      lowStockThreshold: 8,
      isActive: true,
      createdAt: isoDaysAgo(24, 9, 0),
      updatedAt: isoDaysAgo(1, 16, 40),
    },
    {
      id: pSoap,
      name: 'লাক্স সাবান (১০০ গ্রাম)',
      category: 'প্রসাধনী ও পরিষ্কারক',
      unit: 'পিস',
      purchasePrice: 54,
      sellingPrice: 65,
      stockQty: 30,
      lowStockThreshold: 10,
      isActive: true,
      createdAt: isoDaysAgo(20, 9, 0),
      updatedAt: isoDaysAgo(2, 10, 0),
    },
    {
      id: pAtta,
      name: 'আটা (২ কেজি প্যাকেট)',
      category: 'মুদি ও খাদ্যসামগ্রী',
      unit: 'প্যাকেট',
      purchasePrice: 106,
      sellingPrice: 120,
      stockQty: 18,
      lowStockThreshold: 8,
      isActive: true,
      createdAt: isoDaysAgo(20, 9, 0),
      updatedAt: isoDaysAgo(2, 10, 0),
    },
  ];

  const moneyMovements: MoneyMovement[] = [];
  const dueTransactions: DueTransaction[] = [];
  const stockMovements: StockMovement[] = [];
  const auditLogs: AuditLog[] = [];

  // Helper to push sale + linked records cleanly
  const sales: SaleRecord[] = [];
  const purchases: PurchaseRecord[] = [];
  const expenses: ExpenseRecord[] = [];

  // 1. Today — Product-based walk-in cash sale (fully paid, known cost)
  const sale1Date = isoDaysAgo(0, 9, 45);
  sales.push({
    id: 'sale-1',
    invoiceNo: 'INV-1001',
    mode: 'product',
    status: 'active',
    partyId: null,
    partyName: 'নগদ ক্রেতা',
    items: [
      { productId: pRice, name: 'মিনিকেট চাল (১ কেজি)', unit: 'কেজি', qty: 5, unitPrice: 74, unitCostSnapshot: 66, lineTotal: 370 },
      { productId: pOil, name: 'সয়াবিন তেল (২ লিটার)', unit: 'বোতল', qty: 2, unitPrice: 340, unitCostSnapshot: 318, lineTotal: 680 },
    ],
    subtotal: 1050,
    discount: 0,
    total: 1050,
    paidAmount: 1050,
    dueAmount: 0,
    paymentMethod: 'cash',
    moneyMovementId: 'mm-sale-1',
    dueTransactionId: null,
    note: 'সকালের নগদ বিক্রি',
    date: sale1Date,
    revision: 1,
    createdAt: sale1Date,
    updatedAt: sale1Date,
  });
  moneyMovements.push({
    id: 'mm-sale-1',
    direction: 'in',
    channel: 'cash',
    sourceType: 'sale_payment',
    sourceId: 'sale-1',
    partyId: null,
    partyName: 'নগদ ক্রেতা',
    amount: 1050,
    note: 'বিক্রি #INV-1001',
    status: 'active',
    date: sale1Date,
    createdAt: sale1Date,
    updatedAt: sale1Date,
  });
  stockMovements.push(
    { id: 'sm-1a', productId: pRice, productName: 'মিনিকেট চাল (১ কেজি)', deltaQty: -5, reason: 'sale', sourceType: 'sale', sourceId: 'sale-1', date: sale1Date, createdAt: sale1Date },
    { id: 'sm-1b', productId: pOil, productName: 'সয়াবিন তেল (২ লিটার)', deltaQty: -2, reason: 'sale', sourceType: 'sale', sourceId: 'sale-1', date: sale1Date, createdAt: sale1Date }
  );

  // 2. Today — Quick direct-amount walk-in sale via bKash (NO cost data -> triggers honest completeness indicator!)
  const sale2Date = isoDaysAgo(0, 12, 10);
  sales.push({
    id: 'sale-2',
    invoiceNo: 'INV-1002',
    mode: 'quick',
    status: 'active',
    partyId: null,
    partyName: 'নগদ ক্রেতা',
    description: 'খুচরা মসলা ও নাস্তা সামগ্রী',
    items: [
      { productId: null, name: 'খুচরা মসলা ও নাস্তা সামগ্রী', qty: 1, unitPrice: 850, unitCostSnapshot: null, lineTotal: 850 },
    ],
    subtotal: 850,
    discount: 0,
    total: 850,
    paidAmount: 850,
    dueAmount: 0,
    paymentMethod: 'bkash',
    moneyMovementId: 'mm-sale-2',
    dueTransactionId: null,
    note: 'বিকাশে পেমেন্ট',
    date: sale2Date,
    revision: 1,
    createdAt: sale2Date,
    updatedAt: sale2Date,
  });
  moneyMovements.push({
    id: 'mm-sale-2',
    direction: 'in',
    channel: 'bkash',
    sourceType: 'sale_payment',
    sourceId: 'sale-2',
    partyId: null,
    partyName: 'নগদ ক্রেতা',
    amount: 850,
    note: 'সহজ বিক্রি #INV-1002',
    status: 'active',
    date: sale2Date,
    createdAt: sale2Date,
    updatedAt: sale2Date,
  });

  // 3. Today — Partial-credit product sale to Kamrul Islam (paid 1,000 cash, due 1,400)
  const sale3Date = isoDaysAgo(0, 11, 20);
  sales.push({
    id: 'sale-3',
    invoiceNo: 'INV-1003',
    mode: 'product',
    status: 'active',
    partyId: c1,
    partyName: 'কামরুল ইসলাম',
    items: [
      { productId: pRice, name: 'মিনিকেট চাল (১ কেজি)', unit: 'কেজি', qty: 10, unitPrice: 74, unitCostSnapshot: 66, lineTotal: 740 },
      { productId: pOil, name: 'সয়াবিন তেল (২ লিটার)', unit: 'বোতল', qty: 3, unitPrice: 340, unitCostSnapshot: 318, lineTotal: 1020 },
      { productId: pDal, name: 'মসুর ডাল (১ কেজি)', unit: 'কেজি', qty: 5, unitPrice: 132, unitCostSnapshot: 118, lineTotal: 660 },
    ],
    subtotal: 2420,
    discount: 20,
    total: 2400,
    paidAmount: 1000,
    dueAmount: 1400,
    paymentMethod: 'cash',
    moneyMovementId: 'mm-sale-3',
    dueTransactionId: 'due-c1-3',
    note: 'আংশিক নগদ ও বাকি',
    date: sale3Date,
    revision: 1,
    createdAt: sale3Date,
    updatedAt: sale3Date,
  });
  moneyMovements.push({
    id: 'mm-sale-3',
    direction: 'in',
    channel: 'cash',
    sourceType: 'sale_payment',
    sourceId: 'sale-3',
    partyId: c1,
    partyName: 'কামরুল ইসলাম',
    amount: 1000,
    note: 'বিক্রি #INV-1003 আংশিক নগদ',
    status: 'active',
    date: sale3Date,
    createdAt: sale3Date,
    updatedAt: sale3Date,
  });

  // 4. Yesterday — Partial-credit product sale to পিছনের চা দোকান
  const sale4Date = isoDaysAgo(1, 16, 40);
  sales.push({
    id: 'sale-4',
    invoiceNo: 'INV-1004',
    mode: 'product',
    status: 'active',
    partyId: c2,
    partyName: 'পিছনের চা দোকান',
    items: [
      { productId: pSugar, name: 'সাদা চিনি (১ কেজি)', unit: 'কেজি', qty: 8, unitPrice: 135, unitCostSnapshot: 122, lineTotal: 1080 },
      { productId: pTea, name: 'চা পাতা (৪০০ গ্রাম)', unit: 'প্যাকেট', qty: 5, unitPrice: 220, unitCostSnapshot: 195, lineTotal: 1100 },
    ],
    subtotal: 2180,
    discount: 30,
    total: 2150,
    paidAmount: 400,
    dueAmount: 1750,
    paymentMethod: 'nagad',
    moneyMovementId: 'mm-sale-4',
    dueTransactionId: 'due-c2-1',
    note: 'চা দোকানের সাপ্তাহিক মালামাল',
    date: sale4Date,
    revision: 1,
    createdAt: sale4Date,
    updatedAt: sale4Date,
  });
  moneyMovements.push({
    id: 'mm-sale-4',
    direction: 'in',
    channel: 'nagad',
    sourceType: 'sale_payment',
    sourceId: 'sale-4',
    partyId: c2,
    partyName: 'পিছনের চা দোকান',
    amount: 400,
    note: 'বিক্রি #INV-1004 আংশিক নগদ (MFS)',
    status: 'active',
    date: sale4Date,
    createdAt: sale4Date,
    updatedAt: sale4Date,
  });

  // 5. 2 Days Ago — Product cash sale + Quick sale
  const sale5Date = isoDaysAgo(2, 13, 15);
  sales.push({
    id: 'sale-5',
    invoiceNo: 'INV-1005',
    mode: 'product',
    status: 'active',
    partyId: c3,
    partyName: 'ইমরান হোসেন',
    items: [
      { productId: pAtta, name: 'আটা (২ কেজি প্যাকেট)', unit: 'প্যাকেট', qty: 6, unitPrice: 120, unitCostSnapshot: 106, lineTotal: 720 },
      { productId: pSoap, name: 'লাক্স সাবান (১০০ গ্রাম)', unit: 'পিস', qty: 10, unitPrice: 65, unitCostSnapshot: 54, lineTotal: 650 },
      { productId: pSugar, name: 'সাদা চিনি (১ কেজি)', unit: 'কেজি', qty: 4, unitPrice: 135, unitCostSnapshot: 122, lineTotal: 540 },
    ],
    subtotal: 1910,
    discount: 10,
    total: 1900,
    paidAmount: 600,
    dueAmount: 1300,
    paymentMethod: 'cash',
    moneyMovementId: 'mm-sale-5',
    dueTransactionId: 'due-c3-1',
    note: 'মাসিক বাজার',
    date: sale5Date,
    revision: 1,
    createdAt: sale5Date,
    updatedAt: sale5Date,
  });
  moneyMovements.push({
    id: 'mm-sale-5',
    direction: 'in',
    channel: 'cash',
    sourceType: 'sale_payment',
    sourceId: 'sale-5',
    partyId: c3,
    partyName: 'ইমরান হোসেন',
    amount: 600,
    note: 'বিক্রি #INV-1005 আংশিক নগদ',
    status: 'active',
    date: sale5Date,
    createdAt: sale5Date,
    updatedAt: sale5Date,
  });

  const sale6Date = isoDaysAgo(3, 18, 10);
  sales.push({
    id: 'sale-6',
    invoiceNo: 'INV-1006',
    mode: 'quick',
    status: 'active',
    partyId: c4,
    partyName: 'পারভেজ মিয়া',
    description: 'বিস্কুট, কেক ও কোল্ড ড্রিংকস',
    items: [
      { productId: null, name: 'বিস্কুট, কেক ও কোল্ড ড্রিংকস', qty: 1, unitPrice: 950, unitCostSnapshot: null, lineTotal: 950 },
    ],
    subtotal: 950,
    discount: 0,
    total: 950,
    paidAmount: 500,
    dueAmount: 450,
    paymentMethod: 'cash',
    moneyMovementId: 'mm-sale-6',
    dueTransactionId: 'due-c4-1',
    note: 'বাকি থাকল ৪৫০ টাকা',
    date: sale6Date,
    revision: 1,
    createdAt: sale6Date,
    updatedAt: sale6Date,
  });
  moneyMovements.push({
    id: 'mm-sale-6',
    direction: 'in',
    channel: 'cash',
    sourceType: 'sale_payment',
    sourceId: 'sale-6',
    partyId: c4,
    partyName: 'পারভেজ মিয়া',
    amount: 500,
    note: 'সহজ বিক্রি #INV-1006 আংশিক',
    status: 'active',
    date: sale6Date,
    createdAt: sale6Date,
    updatedAt: sale6Date,
  });

  // Purchases
  const purch1Date = isoDaysAgo(1, 10, 30);
  purchases.push({
    id: 'purch-1',
    billNo: 'BILL-201',
    mode: 'product',
    status: 'active',
    partyId: s1,
    partyName: 'ঢাকা হোলসেল ট্রেডার্স',
    items: [
      { productId: pRice, name: 'মিনিকেট চাল (১ কেজি)', unit: 'কেজি', qty: 50, unitPrice: 66, lineTotal: 3300 },
      { productId: pOil, name: 'সয়াবিন তেল (২ লিটার)', unit: 'বোতল', qty: 20, unitPrice: 318, lineTotal: 6360 },
      { productId: pDal, name: 'মসুর ডাল (১ কেজি)', unit: 'কেজি', qty: 20, unitPrice: 118, lineTotal: 2360 },
    ],
    total: 12020,
    paidAmount: 7520,
    dueAmount: 4500,
    paymentMethod: 'bank',
    moneyMovementId: 'mm-purch-1',
    dueTransactionId: 'due-s1-1',
    note: 'ব্যাংক চেকের মাধ্যমে আংশিক পরিশোধ',
    date: purch1Date,
    revision: 1,
    createdAt: purch1Date,
    updatedAt: purch1Date,
  });
  moneyMovements.push({
    id: 'mm-purch-1',
    direction: 'out',
    channel: 'bank',
    sourceType: 'purchase_payment',
    sourceId: 'purch-1',
    partyId: s1,
    partyName: 'ঢাকা হোলসেল ট্রেডার্স',
    amount: 7520,
    note: 'ক্রয় #BILL-201 আংশিক পরিশোধ',
    status: 'active',
    date: purch1Date,
    createdAt: purch1Date,
    updatedAt: purch1Date,
  });

  const purch2Date = isoDaysAgo(3, 11, 0);
  purchases.push({
    id: 'purch-2',
    billNo: 'BILL-202',
    mode: 'product',
    status: 'active',
    partyId: s2,
    partyName: 'আলম এন্টারপ্রাইজ',
    items: [
      { productId: pAtta, name: 'আটা (২ কেজি প্যাকেট)', unit: 'প্যাকেট', qty: 20, unitPrice: 106, lineTotal: 2120 },
      { productId: pSoap, name: 'লাক্স সাবান (১০০ গ্রাম)', unit: 'পিস', qty: 30, unitPrice: 54, lineTotal: 1620 },
    ],
    total: 3740,
    paidAmount: 1940,
    dueAmount: 1800,
    paymentMethod: 'cash',
    moneyMovementId: 'mm-purch-2',
    dueTransactionId: 'due-s2-1',
    note: 'বাকি ১,৮০০ টাকা',
    date: purch2Date,
    revision: 1,
    createdAt: purch2Date,
    updatedAt: purch2Date,
  });
  moneyMovements.push({
    id: 'mm-purch-2',
    direction: 'out',
    channel: 'cash',
    sourceType: 'purchase_payment',
    sourceId: 'purch-2',
    partyId: s2,
    partyName: 'আলম এন্টারপ্রাইজ',
    amount: 1940,
    note: 'ক্রয় #BILL-202 নগদ',
    status: 'active',
    date: purch2Date,
    createdAt: purch2Date,
    updatedAt: purch2Date,
  });

  // Due Transactions (with exact chronological running balances!)
  // Kamrul Islam (c1):
  //   5 days ago: previous due given 2,500 -> balance 2,500
  //   2 days ago: customer collection received 1,500 (bkash) -> balance 1,000
  //   Today: sale-3 due 1,400 -> balance 2,400
  const c1d1 = isoDaysAgo(5, 12, 30);
  const c1d2 = isoDaysAgo(2, 17, 15);
  dueTransactions.push(
    {
      id: 'due-c1-1',
      partyId: c1,
      partyRole: 'customer',
      direction: 'given',
      source: 'manual_due',
      sourceId: null,
      moneyMovementId: null,
      paymentMethod: null,
      amount: 2500,
      runningBalance: 2500,
      note: 'পূর্বের খাতার বাকি জের',
      status: 'active',
      date: c1d1,
      revision: 1,
      createdAt: c1d1,
      updatedAt: c1d1,
    },
    {
      id: 'due-c1-2',
      partyId: c1,
      partyRole: 'customer',
      direction: 'received',
      source: 'customer_collection',
      sourceId: null,
      moneyMovementId: 'mm-coll-c1-2',
      paymentMethod: 'bkash',
      amount: 1500,
      runningBalance: 1000,
      note: 'বাকি আদায় (বিকাশ)',
      status: 'active',
      date: c1d2,
      revision: 1,
      createdAt: c1d2,
      updatedAt: c1d2,
    },
    {
      id: 'due-c1-3',
      partyId: c1,
      partyRole: 'customer',
      direction: 'given',
      source: 'sale',
      sourceId: 'sale-3',
      moneyMovementId: null,
      paymentMethod: null,
      amount: 1400,
      runningBalance: 2400,
      note: 'বিক্রি #INV-1003 থেকে বাকি',
      status: 'active',
      date: sale3Date,
      revision: 1,
      createdAt: sale3Date,
      updatedAt: sale3Date,
    }
  );
  moneyMovements.push({
    id: 'mm-coll-c1-2',
    direction: 'in',
    channel: 'bkash',
    sourceType: 'customer_collection',
    sourceId: 'due-c1-2',
    partyId: c1,
    partyName: 'কামরুল ইসলাম',
    amount: 1500,
    note: 'কাস্টমার বাকি আদায়',
    status: 'active',
    date: c1d2,
    createdAt: c1d2,
    updatedAt: c1d2,
  });

  // Halim Kaka (c5): had 800 due, paid 800 cash -> balance 0
  const c5d1 = isoDaysAgo(6, 11, 0);
  const c5d2 = isoDaysAgo(4, 15, 0);
  dueTransactions.push(
    {
      id: 'due-c5-1',
      partyId: c5,
      partyRole: 'customer',
      direction: 'given',
      source: 'manual_due',
      sourceId: null,
      moneyMovementId: null,
      paymentMethod: null,
      amount: 800,
      runningBalance: 800,
      note: 'পূর্বের বাকি',
      status: 'active',
      date: c5d1,
      revision: 1,
      createdAt: c5d1,
      updatedAt: c5d1,
    },
    {
      id: 'due-c5-2',
      partyId: c5,
      partyRole: 'customer',
      direction: 'received',
      source: 'customer_collection',
      sourceId: null,
      moneyMovementId: 'mm-coll-c5-2',
      paymentMethod: 'cash',
      amount: 800,
      runningBalance: 0,
      note: 'সম্পূর্ণ বাকি পরিশোধ',
      status: 'active',
      date: c5d2,
      revision: 1,
      createdAt: c5d2,
      updatedAt: c5d2,
    }
  );
  moneyMovements.push({
    id: 'mm-coll-c5-2',
    direction: 'in',
    channel: 'cash',
    sourceType: 'customer_collection',
    sourceId: 'due-c5-2',
    partyId: c5,
    partyName: 'হালিম কাকা',
    amount: 800,
    note: 'বাকি আদায় (নগদ)',
    status: 'active',
    date: c5d2,
    createdAt: c5d2,
    updatedAt: c5d2,
  });

  // Other party due entries linked to sales & purchases
  dueTransactions.push(
    {
      id: 'due-c2-1',
      partyId: c2,
      partyRole: 'customer',
      direction: 'given',
      source: 'sale',
      sourceId: 'sale-4',
      moneyMovementId: null,
      paymentMethod: null,
      amount: 1750,
      runningBalance: 1750,
      note: 'বিক্রি #INV-1004 থেকে বাকি',
      status: 'active',
      date: sale4Date,
      revision: 1,
      createdAt: sale4Date,
      updatedAt: sale4Date,
    },
    {
      id: 'due-c3-1',
      partyId: c3,
      partyRole: 'customer',
      direction: 'given',
      source: 'sale',
      sourceId: 'sale-5',
      moneyMovementId: null,
      paymentMethod: null,
      amount: 1300,
      runningBalance: 1300,
      note: 'বিক্রি #INV-1005 থেকে বাকি',
      status: 'active',
      date: sale5Date,
      revision: 1,
      createdAt: sale5Date,
      updatedAt: sale5Date,
    },
    {
      id: 'due-c4-1',
      partyId: c4,
      partyRole: 'customer',
      direction: 'given',
      source: 'sale',
      sourceId: 'sale-6',
      moneyMovementId: null,
      paymentMethod: null,
      amount: 450,
      runningBalance: 450,
      note: 'বিক্রি #INV-1006 থেকে বাকি',
      status: 'active',
      date: sale6Date,
      revision: 1,
      createdAt: sale6Date,
      updatedAt: sale6Date,
    },
    {
      id: 'due-s1-1',
      partyId: s1,
      partyRole: 'supplier',
      direction: 'received',
      source: 'purchase',
      sourceId: 'purch-1',
      moneyMovementId: null,
      paymentMethod: null,
      amount: 4500,
      runningBalance: -4500,
      note: 'ক্রয় #BILL-201 থেকে সাপ্লায়ার বাকি',
      status: 'active',
      date: purch1Date,
      revision: 1,
      createdAt: purch1Date,
      updatedAt: purch1Date,
    },
    {
      id: 'due-s2-1',
      partyId: s2,
      partyRole: 'supplier',
      direction: 'received',
      source: 'purchase',
      sourceId: 'purch-2',
      moneyMovementId: null,
      paymentMethod: null,
      amount: 1800,
      runningBalance: -1800,
      note: 'ক্রয় #BILL-202 থেকে সাপ্লায়ার বাকি',
      status: 'active',
      date: purch2Date,
      revision: 1,
      createdAt: purch2Date,
      updatedAt: purch2Date,
    }
  );

  // Daily Shop Expenses (each linked 1:1 to a canonical MoneyMovement)
  const exp1Date = isoDaysAgo(0, 10, 15);
  const exp2Date = isoDaysAgo(1, 14, 0);
  const exp3Date = isoDaysAgo(2, 18, 30);

  expenses.push(
    {
      id: 'exp-1',
      category: 'চা-নাস্তা',
      title: 'দোকানের সকালের চা-নাস্তা',
      amount: 120,
      paymentMethod: 'cash',
      moneyMovementId: 'mm-exp-1',
      note: 'দৈনিক খরচ',
      status: 'active',
      date: exp1Date,
      revision: 1,
      createdAt: exp1Date,
      updatedAt: exp1Date,
    },
    {
      id: 'exp-2',
      category: 'বিদ্যুৎ বিল',
      title: 'দোকানের মাসিক বিদ্যুৎ বিল',
      amount: 1450,
      paymentMethod: 'bkash',
      moneyMovementId: 'mm-exp-2',
      note: 'বিকাশে বিল পরিশোধ',
      status: 'active',
      date: exp2Date,
      revision: 1,
      createdAt: exp2Date,
      updatedAt: exp2Date,
    },
    {
      id: 'exp-3',
      category: 'পরিবহন',
      title: 'মালামাল আনার ভ্যান ভাড়া',
      amount: 350,
      paymentMethod: 'cash',
      moneyMovementId: 'mm-exp-3',
      note: 'পাইকারি বাজার থেকে',
      status: 'active',
      date: exp3Date,
      revision: 1,
      createdAt: exp3Date,
      updatedAt: exp3Date,
    }
  );

  moneyMovements.push(
    {
      id: 'mm-exp-1',
      direction: 'out',
      channel: 'cash',
      sourceType: 'expense',
      sourceId: 'exp-1',
      amount: 120,
      note: 'চা-নাস্তা',
      status: 'active',
      date: exp1Date,
      createdAt: exp1Date,
      updatedAt: exp1Date,
    },
    {
      id: 'mm-exp-2',
      direction: 'out',
      channel: 'bkash',
      sourceType: 'expense',
      sourceId: 'exp-2',
      amount: 1450,
      note: 'দোকানের মাসিক বিদ্যুৎ বিল',
      status: 'active',
      date: exp2Date,
      createdAt: exp2Date,
      updatedAt: exp2Date,
    },
    {
      id: 'mm-exp-3',
      direction: 'out',
      channel: 'cash',
      sourceType: 'expense',
      sourceId: 'exp-3',
      amount: 350,
      note: 'মালামাল আনার ভ্যান ভাড়া',
      status: 'active',
      date: exp3Date,
      createdAt: exp3Date,
      updatedAt: exp3Date,
    }
  );

  // Initial append-only audit logs
  for (const s of sales) {
    auditLogs.push({
      id: `audit-${s.id}`,
      entityType: 'sale',
      entityId: s.id,
      action: 'create',
      summary: `বিক্রি ${s.invoiceNo} তৈরি হয়েছে (মোট ${s.total} টাকা, জমা ${s.paidAmount} টাকা)`,
      timestamp: s.createdAt,
    });
  }
  for (const p of purchases) {
    auditLogs.push({
      id: `audit-${p.id}`,
      entityType: 'purchase',
      entityId: p.id,
      action: 'create',
      summary: `ক্রয় ${p.billNo} তৈরি হয়েছে (মোট ${p.total} টাকা, পরিশোধ ${p.paidAmount} টাকা)`,
      timestamp: p.createdAt,
    });
  }
  for (const e of expenses) {
    auditLogs.push({
      id: `audit-${e.id}`,
      entityType: 'expense',
      entityId: e.id,
      action: 'create',
      summary: `খরচ "${e.title}" তৈরি হয়েছে (${e.amount} টাকা)`,
      timestamp: e.createdAt,
    });
  }

  return {
    businessProfile,
    parties,
    products,
    sales,
    purchases,
    moneyMovements,
    dueTransactions,
    expenses,
    stockMovements,
    auditLogs,
  };
}
