/** Backup reminder rule (S8): remind when there are records and no backup in the last N days. */
export const BACKUP_REMINDER_DAYS = 7;

export function needsBackupReminder(lastBackupAt: string | null, recordCount: number, now: Date = new Date()): boolean {
  if (recordCount === 0) return false;
  if (!lastBackupAt) return true;
  const age = now.getTime() - new Date(lastBackupAt).getTime();
  return !(age >= 0 && age < BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000);
}
