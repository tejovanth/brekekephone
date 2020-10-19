import stringify from 'json-stable-stringify'
import debounce from 'lodash/debounce'
import uniqBy from 'lodash/uniqBy'
import { v4 as uuid } from 'react-native-uuid'

import { intlDebug } from '../intl/intl'
import { RnAsyncStorage } from '../Rn'
import { arrToMap } from '../utils/toMap'
import g from './_'

let resolveFn: Function | null
const profilesLoaded = new Promise(resolve => {
  resolveFn = resolve
})

export interface Profile {
  id: string
  pbxHostname: string
  pbxPort: string
  pbxTenant: string
  pbxUsername: string
  pbxPassword: string
  pbxPhoneIndex: '1' | '2' | '3' | '4'
  pbxTurnEnabled: boolean
  pushNotificationEnabled: boolean
  parks: string[]
  ucEnabled: boolean
  ucHostname: string
  ucPort: string
  ucPathname: string
  displaySharedContacts?: boolean
  displayOfflineUsers?: boolean
  navIndex?: number
  navSubMenus?: string[]
}
export interface ProfileData {
  id: string
  accessToken: string
  recentCalls: {
    id: string
    incoming: boolean
    answered: boolean
    partyName: string
    partyNumber: string
    created: number
  }[]
  recentChats: {
    id: string // thread id
    name: string
    text: string
    group: boolean
    unread: boolean
    created: number
  }[]
}

g.extends({
  observable: {
    profiles: ([] as any) as Profile[],
    get profilesMap() {
      return arrToMap(g.profiles, 'id', p => p)
    },
    profileData: ([] as any) as ProfileData[],
    profilesLoadedObservable: false,
  },
  profilesLoaded,
  genEmptyProfile: () => ({
    id: uuid(),
    pbxTenant: '',
    pbxUsername: '',
    pbxHostname: '',
    pbxPort: '',
    pbxPassword: '',
    pbxPhoneIndex: '',
    pbxTurnEnabled: false,
    pushNotificationEnabled: true,
    parks: ([] as any) as string[],
    ucEnabled: false,
    ucHostname: '',
    ucPort: '',
  }),
  loadProfilesFromLocalStorage: async () => {
    let arr = await RnAsyncStorage.getItem('_api_profiles')
    let x: any
    if (arr && !Array.isArray(arr)) {
      try {
        x = JSON.parse(arr)
      } catch (err) {
        x = null
      }
    }
    if (x) {
      let { profileData, profiles } = x
      if (Array.isArray(x)) {
        profiles = x
        profileData = []
      }
      g.set('profiles', profiles)
      g.set('profileData', uniqBy(profileData, 'id'))
    }
    if (resolveFn) {
      resolveFn()
      resolveFn = null
      g.set('profilesLoadedObservable', true)
    }
  },
  saveProfilesToLocalStorage: async () => {
    try {
      const { profiles, profileData } = g
      await RnAsyncStorage.setItem(
        '_api_profiles',
        JSON.stringify({ profiles, profileData }),
      )
    } catch (err) {
      g.showError({
        message: intlDebug`Failed to save accounts to local storage`,
        err,
      })
    }
  },
  upsertProfile: p => {
    g.upsert('profiles', p)
    if (p.ucEnabled) {
      const p0 = g.profiles.find(_ => _.id === p.id)
      if (!p0.ucHostname && !p0.ucPort) {
        p0.ucHostname = p0.pbxHostname
        p0.ucPort = p0.pbxPort
      }
    }
    g.saveProfilesToLocalStorage()
  },
  removeProfile: id => {
    g.remove('profiles', id)
    g.saveProfilesToLocalStorage()
  },
  getProfileData: p => {
    if (!p.pbxUsername || !p.pbxTenant || !p.pbxHostname || !p.pbxPort) {
      return null
    }
    const id = stringify({
      u: p.pbxUsername,
      t: p.pbxTenant,
      h: p.pbxHostname,
      p: p.pbxPort,
    })
    const d = g.profileData.find(d => d.id === id) || {
      id,
      accessToken: '',
      recentCalls: [],
      recentChats: [],
    }
    g.updateProfileDataDebounced(d)
    return d
  },
  updateProfileDataDebounced: debounce(
    d => {
      if (d.id === g.profileData[0]?.id) {
        return
      }
      const arr = [d, ...g.profileData.filter(d2 => d2.id !== d.id)]
      if (arr.length > 20) {
        arr.pop()
      }
      g.profileData = arr
      g.saveProfilesToLocalStorage()
    },
    300,
    { maxWait: 3000 },
  ),
})