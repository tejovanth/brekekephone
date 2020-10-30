import Handlebars from 'handlebars/dist/handlebars'
import HandlebarsMoment from 'helper-moment'

import g from '../global/_'
import Picker from '../global/Picker'
import { RnAsyncStorage } from '../Rn'
import { arrToMap } from '../utils/toMap'
import waitTimeout from '../utils/waitTimeout'
import en from './en.json'
import ja from './ja.json'
import vi from './vi.json'

Handlebars.registerHelper('moment', HandlebarsMoment)

const labels = {
  en,
  ja,
  vi,
}
const enLabelsMapIndex = arrToMap(
  en,
  k => k,
  (_, i) => i,
)

const localeOptions = [
  { key: 'en', label: 'English' },
  // { key: 'ja', label: '日本語' },
  // { key: 'vi', label: 'Tiếng Việt' },
]

g.extends({
  observable: {
    locale: 'en',
    localeReady: false,
    localeLoading: true,
    get localeName() {
      return localeOptions.find(o => o.key === g.locale)?.label
    },
  },
  initLocale: async () => {
    await g.getLocaleFromLocalStorage()
    g.localeReady = true
    g.localeLoading = false
  },
  getLocaleFromLocalStorage: async () => {
    let locale = await RnAsyncStorage.getItem('locale')
    if (!locale || !labels[locale]) {
      locale = 'en'
      await RnAsyncStorage.setItem('locale', locale)
    }
    g.locale = locale
  },
  setLocale: async locale => {
    if (g.localeLoading || locale === g.locale) {
      return
    }
    g.localeLoading = true
    if (!labels[locale]) {
      locale = 'en'
    }
    await RnAsyncStorage.setItem('locale', locale)
    await waitTimeout()
    g.locale = locale
    g.localeLoading = false
  },
  selectLocale: () => {
    Picker.open({
      options: localeOptions,
      selectedKey: g.locale,
      onSelect: g.setLocale,
    })
  },
})

const compileFn = (locale, k) => {
  const arr = labels[locale]
  const i = enLabelsMapIndex[k]
  //
  let fn = arr[i]
  if (!fn || typeof fn !== 'function') {
    fn = Handlebars.compile(k)
  }
  if (i !== undefined) {
    arr[i] = fn
  }
  //
  return fn
}

const intl0 = (k, data) => compileFn(g.locale, k)(data)
const intlDebug0 = (k, data) => ({
  label: intl(k, data),
  en: compileFn('en', k)(data),
})

g.initLocale()

export interface IntlDebug {
  label: string
  en: string
}
export const intlDebug = (intlDebug0 as unknown) as (
  template: TemplateStringsArray,
  ...substitutions: any[]
) => IntlDebug

const intl = (intl0 as unknown) as (
  template: TemplateStringsArray,
  ...substitutions: any[]
) => string
export default intl
