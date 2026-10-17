import { useCallback } from 'react';
import { useLocales } from 'expo-localization';

import { useLocalData } from '@/hooks/useLocalData';
import { en, es, type TranslationKey } from './catalog';

export function useTranslation() {
  const { preferences } = useLocalData();
  const locales = useLocales();
  const language = preferences.language === 'system' ? (locales[0]?.languageCode === 'es' ? 'es' : 'en') : preferences.language;
  const locale = language === 'es' ? 'es-CR' : 'en-US';
  const t = useCallback((key: TranslationKey, params: Record<string, string | number> = {}): string => {
    const value: string = (language === 'es' ? es : en)[key];
    return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
  }, [language]);
  const birdName = useCallback((bird: { common: string; scientific: string }) =>
    language === 'es' ? bird.scientific : bird.common, [language]);
  const errorText = useCallback((text: string) => {
    const known: Record<string, TranslationKey> = {
      'Microphone access is needed to hear birds.': 'micPermission',
      'Return to Birdsong and tap the microphone again.': 'returnApp',
      'Audio is still finishing. Wait a moment, then try again.': 'finishing',
      'Wait for 3 seconds of microphone audio first.': 'diagnosticWait',
      'Save a diagnostic clip first.': 'clipFirst',
      'BirdNET model could not be loaded from a local file.': 'localModelError',
      'No GPS fix yet. Try again outside or near a window.': 'noFix',
      'Device location is off. Enable it, then tap to retry.': 'locationOff',
    };
    return known[text] ? t(known[text]) : text;
  }, [t]);
  return { t, language, locale, birdName, errorText };
}
