/**
 * Our own wording, in ONE place. Jomarkhata must not read like other khata apps (owner request,
 * 2026-11-23): the screens use "পাওনা / দেনা" and plain sentences, not another product's labels.
 * Change a word here and it changes everywhere.
 */
export const T = {
  /** They owe me (balance > 0). */
  receivable: 'পাওনা',
  /** I owe them (balance < 0). */
  payable: 'দেনা',
  settled: 'হিসাব মিটে গেছে',
  dueBook: 'পাওনা-দেনা',
  newDueEntry: 'লেনদেন লিখুন',
  sale: 'বিক্রি',
  purchase: 'কেনা',
  salesBook: 'বিক্রির হিসাব',
  purchaseBook: 'কেনার হিসাব',
  expenseBook: 'খরচের হিসাব',
  collect: 'টাকা আদায়',
  payOff: 'দেনা শোধ',
  remind: 'মনে করান',
  collectionDay: 'আদায়ের দিন',
} as const;
