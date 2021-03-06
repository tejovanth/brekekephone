import debounce from 'lodash/debounce'
import { action, computed, observable } from 'mobx'
import { AppState, Platform } from 'react-native'
import RNCallKeep from 'react-native-callkeep'
import IncallManager from 'react-native-incall-manager'

import pbx from '../api/pbx'
import sip from '../api/sip'
import { arrToMap } from '../utils/toMap'
import Call, { NativeModules0 } from './Call'
import Nav from './Nav'
import { reconnectAndWaitSip } from './reconnectAndWaitSip'

export const uuidFromPN = '00000000-0000-0000-0000-000000000000'

export class CallStore {
  constructor() {
    this._initDurationInterval()
  }

  recentPNAction = ''
  recentPNAt = 0

  @observable _calls: Call[] = []
  recentCallActivityAt = 0
  @observable _currentCallId?: string = undefined
  @computed get incomingCall() {
    return this._calls.find(c => c.incoming && !c.answered)
  }
  @computed get currentCall() {
    this._updateCurrentCallDebounce()
    return this._calls.find(c => c.id === this._currentCallId)
  }
  @computed get backgroundCalls() {
    return this._calls.filter(
      c => c.id !== this._currentCallId && !(c.incoming && !c.answered),
    )
  }

  @observable androidRingtone = 0

  _updateCurrentCall = () => {
    let currentCall: Call | undefined
    if (this._calls.length) {
      currentCall =
        this._calls.find(c => c.id === this._currentCallId) ||
        this._calls.find(c => c.answered && !c.holding) ||
        this._calls[0]
    }
    const currentCallId = currentCall?.id
    if (currentCallId !== this._currentCallId) {
      window.setTimeout(action(() => (this._currentCallId = currentCallId)))
    }
    this._updateBackgroundCallsDebounce()
  }
  _updateCurrentCallDebounce = debounce(this._updateCurrentCall, 500, {
    maxWait: 1000,
  })
  @action _updateBackgroundCalls = () => {
    // Auto hold background calls
    this._calls
      .filter(
        c =>
          c.id !== this._currentCallId &&
          c.answered &&
          !c.transferring &&
          !c.holding,
      )
      .forEach(c => c.toggleHold())
  }
  _updateBackgroundCallsDebounce = debounce(this._updateBackgroundCalls, 500, {
    maxWait: 1000,
  })

  @action upsertCall = (_c: { id: string }) => {
    this.recentCallActivityAt = Date.now()
    let c = this._calls.find(c => c.id === _c.id)
    if (c) {
      Object.assign(c, _c)
      if (c.callkeep && c.answered) {
        c.callkeep = false
        RNCallKeep.endCall(c.uuid)
      }
      return
    }
    //
    c = new Call()
    Object.assign(c, _c)
    this._calls = [c, ...this._calls]
    if (!c.incoming || c.answered || Platform.OS === 'web') {
      return
    }
    window.setTimeout(() => RNCallKeep.endCall(uuidFromPN), 1000)
    //
    const recentPNAction =
      Date.now() - this.recentPNAt < 20000 && this.recentPNAction
    this.recentPNAction = ''
    this.recentPNAt = 0
    //
    if (recentPNAction === 'answered') {
      this.answerCall(c)
      c.answered = true
    } else if (recentPNAction === 'rejected') {
      c.hangup()
      c.rejected = true
    } else {
      c.callkeep = true
      RNCallKeep.displayIncomingCall(
        c.uuid,
        'Brekeke Phone',
        c.partyNumber,
        'generic',
        c.remoteVideoEnabled,
      )
    }
  }
  @action removeCall = (id: string) => {
    this.recentCallActivityAt = Date.now()
    const c = this._calls.find(c => c.id === id)
    this._calls = this._calls.filter(c => c.id !== id)
    if (c?.callkeep) {
      c.callkeep = false
      RNCallKeep.endCall(c.uuid)
    }
    if (Platform.OS === 'android') {
      NativeModules0.IncomingCall.closeIncomingCallActivity()
    }
  }

  findByUuid = (uuid: string) => this._calls.find(c => c.uuid === uuid)
  @action removeByUuid = (uuid: string) => {
    this._calls = this._calls.filter(c => c.uuid !== uuid)
  }

  @action selectBackgroundCall = (c: Call) => {
    if (c.holding) {
      c.toggleHold()
    }
    this._currentCallId = c.id
    Nav().backToPageBackgroundCalls()
  }

  @action answerCall = (c: Call, options?: object) => {
    c.answered = true
    this._currentCallId = c.id
    sip.answerSession(c.id, {
      videoEnabled: c.remoteVideoEnabled,
      ...options,
    })
    Nav().goToPageCallManage()
    if (c.callkeep) {
      c.callkeep = false
      RNCallKeep.endCall(c.uuid)
    }
    if (Platform.OS === 'android') {
      NativeModules0.IncomingCall.closeIncomingCallActivity()
    }
  }

  _startCallIntervalAt = 0
  _startCallIntervalId = 0
  startCall = async (number: string, options = {}) => {
    let reconnectCalled = false
    const _startCall = async () => {
      await pbx.getConfig()
      sip.createSession(number, options)
    }
    try {
      await _startCall()
    } catch (err) {
      reconnectAndWaitSip(_startCall)
      reconnectCalled = true
    }
    Nav().goToPageCallManage()
    // Auto update _currentCallId
    this._currentCallId = undefined
    const prevIds = arrToMap(this._calls, 'id') as { [k: string]: boolean }
    if (this._startCallIntervalId) {
      clearInterval(this._startCallIntervalId)
    }
    this._startCallIntervalAt = Date.now()
    this._startCallIntervalId = window.setInterval(() => {
      const currentCallId = this._calls.map(c => c.id).find(id => !prevIds[id])
      // If after 3 secs, there's no call in the store
      // It's likely a connection issue occurred
      if (
        !reconnectCalled &&
        !currentCallId &&
        Date.now() > this._startCallIntervalAt + 3000
      ) {
        clearInterval(this._startCallIntervalId)
        this._startCallIntervalId = 0
        reconnectAndWaitSip(_startCall)
        return
      }
      if (currentCallId) {
        this._currentCallId = currentCallId
      }
      if (currentCallId || Date.now() > this._startCallIntervalAt + 10000) {
        clearInterval(this._startCallIntervalId)
        this._startCallIntervalId = 0
      }
    }, 100)
  }

  startVideoCall = (number: string) => {
    this.startCall(number, {
      videoEnabled: true,
    })
  }

  @observable isLoudSpeakerEnabled = false
  @action toggleLoudSpeaker = () => {
    if (Platform.OS !== 'web') {
      this.isLoudSpeakerEnabled = !this.isLoudSpeakerEnabled
      IncallManager.setForceSpeakerphoneOn(this.isLoudSpeakerEnabled)
    }
  }

  @observable newVoicemailCount = 0

  // Style in CallVideosUI to save the previous video position
  @observable videoPositionT = 25
  @observable videoPositionL = 5

  _durationIntervalId = 0
  _initDurationInterval = () => {
    this._durationIntervalId = window.setInterval(this._updateDuration, 100)
  }
  @action _updateDuration = () => {
    this._calls
      .filter(c => c.answered)
      .forEach(c => {
        c.duration += 100
      })
  }

  dispose = () => {
    if (this._startCallIntervalId) {
      clearInterval(this._startCallIntervalId)
      this._startCallIntervalId = 0
    }
    // Dont need to dispose duration interval id
    // Because the store is currently global static
  }
}

const callStore = new CallStore()

if (Platform.OS !== 'web') {
  // autorun(() => {
  //   // TODO speaker
  //   // https://github.com/react-native-webrtc/react-native-callkeep/issues/78
  // })
}

if (Platform.OS === 'ios') {
  AppState.addEventListener('change', () => {
    if (AppState.currentState === 'active') {
      callStore._calls
        .filter(c => c.callkeep && c.answered)
        .forEach(c => {
          c.callkeep = false
          RNCallKeep.endCall(c.uuid)
        })
    }
  })
}

if (Platform.OS === 'android') {
  let lastUuid = ''
  let lastTime = 0
  window.setInterval(() => {
    if (callStore.recentPNAt && Date.now() - callStore.recentPNAt >= 15000) {
      callStore.recentPNAt = 0
      NativeModules0.IncomingCall.closeIncomingCallActivity()
    }
    const c = callStore.incomingCall
    if (!c) {
      return
    }
    if (lastUuid !== c.uuid) {
      lastUuid = c.uuid
      lastTime = Date.now()
    } else if (Date.now() - lastTime >= 15000) {
      c.hangup()
      callStore.removeCall(c.id)
    }
  }, 1000)
}

export default callStore
