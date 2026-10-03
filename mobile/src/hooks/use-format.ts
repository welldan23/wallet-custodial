import { useMemo } from 'react';

import { useI18n } from '@/i18n';
import { createFormatter, type Formatter } from '@/lib/format';

/**
 * Formatter angka yang mengikuti bahasa di Pengaturan:
 * Indonesia `1.234,56` · Inggris `1,234.56`.
 */
export function useFormat(): Formatter {
  const { language } = useI18n();
  return useMemo(() => createFormatter(language), [language]);
}
