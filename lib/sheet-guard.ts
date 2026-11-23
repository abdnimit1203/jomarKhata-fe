'use client';

import { createContext, useContext } from 'react';

/**
 * Unsaved-input guard for bottom sheets (S2). ModalSheet calls `markDirty` on any input inside it;
 * the app context then asks before discarding the form on back / close.
 * Outside the app provider it's a no-op, so ModalSheet stays a plain UI component.
 */
export const SheetGuardContext = createContext<{ markDirty: () => void }>({ markDirty: () => {} });

export const useSheetGuard = () => useContext(SheetGuardContext);
