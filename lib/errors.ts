/**
 * Turn low-level storage errors into plain Bangla (S8, plan 7.1). Forms show `err.message` and stay
 * open, so the shopkeeper's typed input is never lost.
 */
function errName(e: unknown): string {
  if (!e || typeof e !== 'object') return '';
  const o = e as { name?: string; inner?: { name?: string } };
  return `${o.name ?? ''} ${o.inner?.name ?? ''}`;
}

export function toFriendlyError(e: unknown): Error {
  const name = errName(e);
  if (/QuotaExceeded/.test(name)) {
    return new Error('ফোনের জায়গা ভরে গেছে, তাই সংরক্ষণ হয়নি। কিছু ছবি/ফাইল মুছে আবার “সংরক্ষণ” চাপুন — আপনার লেখা ফর্মে রাখা আছে।');
  }
  if (/OpenFailed|InvalidState|MissingAPI|DatabaseClosed/.test(name)) {
    return new Error('এই ব্রাউজারে ফোনের ডেটাবেস খোলা যাচ্ছে না (প্রাইভেট/ইনকগনিটো মোড হলে সাধারণ মোডে খুলুন)। অ্যাপ বন্ধ করে আবার খুলুন।');
  }
  return e instanceof Error ? e : new Error('কাজটি করা যায়নি। আবার চেষ্টা করুন।');
}
