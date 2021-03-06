import debounce from 'lodash/debounce'
import { action, autorun, computed, observable } from 'mobx'
import { AppState, Platform } from 'react-native'
import RNCallKeep from 'react-native-callkeep'

import pbx from '../api/pbx'
import sip from '../api/sip'
import { getUrlParams } from '../utils/deeplink'
import { arrToMap } from '../utils/toMap'
import waitTimeout from '../utils/waitTimeout'
import callStore, { uuidFromPN } from './callStore'
import { intlDebug } from './intl'
import Nav from './Nav'
import profileStore, { Profile } from './profileStore'
import { setAuthStore } from './reconnectAndWaitSip'
import RnAlert from './RnAlert'

const compareField = (p1: object, p2: object, field: string) => {
  const v1 = p1[field as keyof typeof p1]
  const v2 = p2[field as keyof typeof p2]
  return !v1 || !v2 || v1 === v2
}
const compareProfile = (p1: { pbxUsername: string }, p2: object) => {
  return (
    p1.pbxUsername && // Must have pbxUsername
    compareField(p1, p2, 'pbxUsername') &&
    compareField(p1, p2, 'pbxTenant') &&
    compareField(p1, p2, 'pbxHostname') &&
    compareField(p1, p2, 'pbxPort')
  )
}

type ConnectionState = 'stopped' | 'connecting' | 'success' | 'failure'

export class AuthStore {
  @observable pbxState: ConnectionState = 'stopped'
  @observable pbxTotalFailure = 0
  @observable sipState: ConnectionState = 'stopped'
  @observable sipTotalFailure = 0
  @observable ucState: ConnectionState = 'stopped'
  @observable ucTotalFailure = 0
  @observable ucLoginFromAnotherPlace = false
  @computed get pbxShouldAuth() {
    return (
      !!this.signedInId &&
      (this.pbxState === 'stopped' ||
        (this.pbxState === 'failure' && !this.pbxTotalFailure))
    )
  }
  @computed get pbxConnectingOrFailure() {
    return ['connecting', 'failure'].some(s => s === this.pbxState)
  }
  @computed get sipShouldAuth() {
    return (
      this.pbxState === 'success' &&
      (this.sipState === 'stopped' ||
        (this.sipState === 'failure' && !this.sipTotalFailure))
    )
  }
  @computed get sipConnectingOrFailure() {
    return ['connecting', 'failure'].some(s => s === this.sipState)
  }
  @computed get ucShouldAuth() {
    return (
      this.currentProfile?.ucEnabled &&
      !this.ucLoginFromAnotherPlace &&
      !this.isSignInByNotification &&
      this.pbxState === 'success' &&
      (this.ucState === 'stopped' ||
        (this.ucState === 'failure' && !this.ucTotalFailure))
    )
  }
  @computed get ucConnectingOrFailure() {
    return (
      this.currentProfile?.ucEnabled &&
      ['connecting', 'failure'].some(s => s === this.ucState)
    )
  }
  @computed get shouldShowConnStatus() {
    return (
      this.pbxConnectingOrFailure ||
      this.sipConnectingOrFailure ||
      this.ucConnectingOrFailure
    )
  }
  @computed get isConnFailure() {
    return [
      this.pbxState,
      this.sipState,
      this.currentProfile?.ucEnabled && this.ucState,
    ].some(s => s === 'failure')
  }

  findProfile = (_p: Partial<Profile>) => {
    return profileStore.profiles.find(p => compareProfile(p, _p))
  }
  pushRecentCall = (call: {
    id: string
    incoming: boolean
    answered: boolean
    partyName: string
    partyNumber: string
    duration: number
    created: string
  }) => {
    this.currentData.recentCalls = [call, ...this.currentData.recentCalls]
    if (this.currentData.recentCalls.length > 20) {
      this.currentData.recentCalls.pop()
    }
    profileStore.saveProfilesToLocalStorage()
  }
  @computed get _profilesMap() {
    return arrToMap(profileStore.profiles, 'id', (p: Profile) => p) as {
      [k: string]: Profile
    }
  }
  getProfile = (id: string) => {
    return this._profilesMap[id]
  }

  @observable signedInId = ''
  @computed get currentProfile() {
    return this.getProfile(this.signedInId)
  }
  @computed get currentData() {
    return profileStore.getProfileData(this.currentProfile)
  }
  signIn = (id: string) => {
    const p = this.getProfile(id)
    if (!p) {
      return false
    }
    const d = profileStore.getProfileData(p)
    if (!p.pbxPassword && !d.accessToken) {
      Nav().goToPageProfileUpdate({ id: p.id })
      RnAlert.error({
        message: intlDebug`The account password is empty`,
      })
      return true
    }
    this.signedInId = p.id
    return true
  }

  signOut = () => {
    callStore._calls.forEach(c => c.hangupWithUnhold())
    if (callStore._calls.length > 0) {
      const intervalStartedAt = Date.now()
      const id = window.setInterval(() => {
        // TODO show/hide loader
        if (!callStore._calls.length || Date.now() > intervalStartedAt + 2000) {
          clearInterval(id)
          this._signOut()
        }
      }, 100)
    } else {
      this._signOut()
    }
  }
  @action _signOut = () => {
    this.signedInId = ''
    this.pbxState = 'stopped'
    this.pbxTotalFailure = 0
    this.sipState = 'stopped'
    sip.disconnect()
    this.sipTotalFailure = 0
    this.ucState = 'stopped'
    this.ucTotalFailure = 0
    this.ucLoginFromAnotherPlace = false
  }

  @action reconnect = () => {
    this.pbxTotalFailure = 0
    this.sipTotalFailure = 0
    this.ucTotalFailure = 0
  }
  @action reconnectWithSetStates = () => {
    this.reconnect()
    this.pbxState = 'failure'
    this.sipState = 'failure'
    this.ucState = 'failure'
  }
  @action reconnectWithUcLoginFromAnotherPlace = () => {
    this.reconnect()
    this.ucLoginFromAnotherPlace = false
  }

  handleUrlParams = async () => {
    await profileStore.profilesLoaded()
    const urlParams = await getUrlParams()
    if (!urlParams) {
      return
    }
    //
    const { _wn, host, phone_idx, port, tenant, user } = urlParams
    if (!tenant || !user) {
      return
    }
    //
    const p = this.findProfile({
      pbxUsername: user,
      pbxTenant: tenant,
      pbxHostname: host,
      pbxPort: port,
    })
    const pbxPhoneIndex = `${parseInt(phone_idx) || 4}`
    //
    if (p) {
      if (!p.pbxHostname) {
        p.pbxHostname = host
      }
      if (!p.pbxPort) {
        p.pbxPort = port
      }
      p.pbxPhoneIndex = pbxPhoneIndex
      const d = profileStore.getProfileData(p)
      if (_wn) {
        d.accessToken = _wn
      }
      //
      profileStore.upsertProfile(p)
      if (p.pbxPassword || d.accessToken) {
        this.signIn(p.id)
      } else {
        Nav().goToPageProfileUpdate({ id: p.id })
      }
      return
    }
    //
    const newP = {
      ...profileStore.genEmptyProfile(),
      pbxTenant: tenant,
      pbxUsername: user,
      pbxHostname: host,
      pbxPort: port,
      pbxPhoneIndex,
    }
    const d = profileStore.getProfileData(newP)
    //
    profileStore.upsertProfile(newP)
    if (d.accessToken) {
      this.signIn(newP.id)
    } else {
      Nav().goToPageProfileUpdate({ id: newP.id })
    }
  }

  @observable isSignInByNotification = false
  clearSignInByNotification = debounce(
    () => {
      // clearSignInByNotification will activate UC login
      // We will only allow UC login when the app is active
      if (AppState.currentState !== 'active') {
        window.setTimeout(this.clearSignInByNotification, 17)
      } else {
        this.isSignInByNotification = false
      }
    },
    10000,
    {
      maxWait: 15000,
    },
  )

  signInByNotification = async (n: {
    to: string
    tenant: string
    isCall: boolean
  }) => {
    this.reconnect()
    await profileStore.profilesLoaded()
    // Find account for the notification target
    const p = this.findProfile({
      ...n,
      pbxUsername: n.to,
      pbxTenant: n.tenant,
    })
    if (!p?.id) {
      return false
    }
    // Use isSignInByNotification to disable UC auto sign in for a while
    if (n.isCall) {
      this.isSignInByNotification = true
      this.clearSignInByNotification()
    }
    // In case the app is already signed in
    if (this.signedInId) {
      try {
        // If PN came and still no sip call it is likely disconnected
        // Set states to failure to reconnect them
        await waitTimeout(1000)
        if (
          n.isCall &&
          !callStore._calls.length &&
          Date.now() > callStore.recentCallActivityAt + 30000
        ) {
          await pbx.getConfig()
          const s = sip.phone.getPhoneStatus()
          if (s !== 'starting' && s !== 'started') {
            throw new Error(`SIP not started: ${s}`)
          }
        }
      } catch (err) {
        console.error(`signInByNotification: trying to reconnect, err=${err}`)
        this.reconnectWithSetStates()
      }
      // Always show notification if the signed in id is another account
      if (this.signedInId !== p.id) {
        return true
      }
      return AppState.currentState !== 'active'
    }
    // Call signIn
    return this.signIn(p.id)
  }

  userExtensionProperties: null | {
    id: string
    name: string
    language: string
    phones: {
      id: string
      type: string
    }[]
  } = null
}

const authStore = new AuthStore()

// Interval 5 seconds for push kit
if (Platform.OS !== 'web') {
  let pnIntervalId = 0
  const clearPNInterval = () => {
    if (pnIntervalId) {
      clearInterval(pnIntervalId)
      pnIntervalId = 0
    }
  }
  const setPNInterval = () => {
    clearPNInterval()
    pnIntervalId = window.setInterval(() => {
      callStore.recentPNAction = ''
      callStore.recentPNAt = 0
      RNCallKeep.endCall(uuidFromPN)
    }, 5000)
  }
  autorun(() => {
    if (authStore.sipState === 'success') {
      setPNInterval()
    } else {
      clearPNInterval()
    }
  })
}

setAuthStore(authStore)

export { compareProfile }
export default authStore
