/**
 * Our own wording, in ONE place. Jomarkhata must not read like other khata apps (owner request,
 * 2026-11-23). Owner, 2026-11-24: "বাকি" is the word shopkeepers understand and our brand, so every
 * due label is built on বাকি (বাকি পাবেন / বাকি দেবেন / বাকি আদায় / বাকি শোধ).
 * Change a word here and it changes everywhere.
 */
export const T = {
  /** They owe me (balance > 0). */
  receivable: 'বাকি পাবেন',
  /** I owe them (balance < 0). */
  payable: 'বাকি দেবেন',
  settled: 'হিসাব মিটে গেছে',
  dueBook: 'বাকি',
  newDueEntry: 'লেনদেন লিখুন',
  sale: 'বিক্রি',
  purchase: 'কেনা',
  salesBook: 'বিক্রির হিসাব',
  purchaseBook: 'কেনার হিসাব',
  expenseBook: 'খরচের হিসাব',
  collect: 'বাকি আদায়',
  payOff: 'বাকি শোধ',
  remind: 'মনে করান',
  collectionDay: 'আদায়ের দিন',
} as const;
