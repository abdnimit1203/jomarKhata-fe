/**
 * The app version, from package.json (injected by next.config.ts). Shown in Settings, and used to
 * match each tutorial video to a release. Bump package.json "version" for every phone release and
 * add a CHANGELOG entry.
 */
import { toBanglaDigits } from '@/lib/format';

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

/** "সংস্করণ ০.২.০" */
export const appVersionLabel = () => `সংস্করণ ${toBanglaDigits(APP_VERSION)}`;
