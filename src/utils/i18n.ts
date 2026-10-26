import { createI18n } from 'vue-i18n'

import english from '~/_locales/en.yml'

export const i18n = createI18n<false>({
  legacy: false,
  locale: 'en' as string,
  fallbackLocale: 'en',
  globalInjection: true,
  messages: { en: english },
})
const locales = import.meta.glob<{ default: typeof english }>(['../_locales/*.yml', '!../_locales/en.yml'])
let generation = 0
export async function loadLocale(language: string) {
  const token = ++generation
  if (!i18n.global.availableLocales.includes(language)) {
    const { default: messages } = await locales[`../_locales/${language}.yml`]()
    i18n.global.setLocaleMessage(language, messages)
  }
  if (token === generation)
    i18n.global.locale.value = language
}
