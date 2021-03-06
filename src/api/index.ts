import moment from 'moment'
import { Platform } from 'react-native'
import { v4 as uuid } from 'react-native-uuid'

import authStore from '../stores/authStore'
import Call from '../stores/Call'
import callStore from '../stores/callStore'
import chatStore from '../stores/chatStore'
import contactStore from '../stores/contactStore'
import { intlDebug } from '../stores/intl'
import RnAlert from '../stores/RnAlert'
// @ts-ignore
import PushNotification from '../utils/PushNotification'
import pbx from './pbx'
import sip from './sip'
import uc from './uc'
import updatePhoneIndex from './updatePhoneIndex'

class Api {
  constructor() {
    pbx.on('connection-started', this.onPBXConnectionStarted)
    pbx.on('connection-stopped', this.onPBXConnectionStopped)
    pbx.on('connection-timeout', this.onPBXConnectionTimeout)
    pbx.on('user-calling', this.onPBXUserCalling)
    pbx.on('user-ringing', this.onPBXUserRinging)
    pbx.on('user-talking', this.onPBXUserTalking)
    pbx.on('user-holding', this.onPBXUserHolding)
    pbx.on('user-hanging', this.onPBXUserHanging)
    pbx.on('voicemail-updated', this.onVoiceMailUpdated)
    sip.on('connection-started', this.onSIPConnectionStarted)
    sip.on('connection-stopped', this.onSIPConnectionStopped)
    sip.on('connection-timeout', this.onSIPConnectionTimeout)
    sip.on('session-started', this.onSIPSessionStarted)
    sip.on('session-updated', this.onSIPSessionUpdated)
    sip.on('session-stopped', this.onSIPSessionStopped)
    uc.on('connection-stopped', this.onUCConnectionStopped)
    uc.on('user-updated', this.onUCUserUpdated)
    uc.on('buddy-chat-created', this.onBuddyChatCreated)
    uc.on('group-chat-created', this.onGroupChatCreated)
    uc.on('chat-group-invited', this.onChatGroupInvited)
    uc.on('chat-group-revoked', this.onChatGroupRevoked)
    uc.on('chat-group-updated', this.onChatGroupUpdated)
    uc.on('file-received', this.onFileReceived)
    uc.on('file-progress', this.onFileProgress)
    uc.on('file-finished', this.onFileFinished)
  }
  pbxAndSipStarted = 0

  onPBXAndSipStarted = async () => {
    try {
      await this._onPBXAndSipStarted()
    } catch (err) {
      console.error('api.onPBXAndSipStarted:', err)
    }
  }

  _onPBXAndSipStarted = async () => {
    if (this.pbxAndSipStarted < 1) {
      this.pbxAndSipStarted += 1
      return
    }

    this.pbxAndSipStarted = 0
    const webPhone = (await updatePhoneIndex()) as { id: string }

    if (!webPhone) {
      return
    }

    this.addPnToken(webPhone)
  }

  addPnToken = async (phone: { id: string }) => {
    let t = await PushNotification.getToken()
    let tvoip = t
    if (Platform.OS === 'ios') {
      tvoip = await PushNotification.getVoipToken()
      if (!t) {
        t = tvoip
      }
    }

    if (!t) {
      return
    }

    if (Platform.OS === 'ios') {
      await pbx.addApnsToken({
        username: phone.id,
        device_id: t,
      })
      await pbx.addApnsToken({
        username: phone.id,
        device_id: tvoip || t,
        voip: true,
      })
    } else if (Platform.OS === 'android') {
      await pbx.addFcmPnToken({
        username: phone.id,
        device_id: t,
      })
      await pbx.addFcmPnToken({
        username: phone.id,
        device_id: t,
        voip: true,
      })
    } else if (Platform.OS === 'web') {
      await pbx.addWebPnToken({
        username: phone.id,
        endpoint: t.endpoint,
        auth_secret: t.auth,
        key: t.p256dh,
      })
    }
  }

  onPBXConnectionStarted = () => {
    this.loadPBXUsers().catch((err: Error) => {
      RnAlert.error({
        message: intlDebug`Failed to load PBX users`,
        err,
      })
    })

    window.setTimeout(this.onPBXAndSipStarted)
  }

  onPBXConnectionStopped = () => {
    authStore.pbxState = 'stopped'
  }

  onPBXConnectionTimeout = () => {
    authStore.pbxState = 'failure'
    authStore.pbxTotalFailure += 1
  }

  loadPBXUsers = async () => {
    if (!authStore.currentProfile) {
      return
    }
    const tenant = authStore.currentProfile.pbxTenant
    const username = authStore.currentProfile.pbxUsername
    const userIds = await pbx
      .getUsers(tenant)
      .then((ids: string[]) => ids.filter(id => id !== username))
    const users = await pbx.getOtherUsers(tenant, userIds)
    contactStore.pbxUsers = users
  }

  onPBXUserCalling = (ev: UserTalkerEvent) => {
    contactStore.setTalkerStatus(ev.user, ev.talker, 'calling')
  }
  onPBXUserRinging = (ev: UserTalkerEvent) => {
    contactStore.setTalkerStatus(ev.user, ev.talker, 'ringing')
  }
  onPBXUserTalking = (ev: UserTalkerEvent) => {
    contactStore.setTalkerStatus(ev.user, ev.talker, 'talking')
  }
  onPBXUserHolding = (ev: UserTalkerEvent) => {
    contactStore.setTalkerStatus(ev.user, ev.talker, 'holding')
  }
  onPBXUserHanging = (ev: UserTalkerEvent) => {
    contactStore.setTalkerStatus(ev.user, ev.talker, '')
  }

  onVoiceMailUpdated = (ev: { new: number }) => {
    callStore.newVoicemailCount = ev?.new || 0
  }

  onSIPConnectionStarted = () => {
    authStore.sipState = 'success'
    window.setTimeout(this.onPBXAndSipStarted)
  }

  onSIPConnectionStopped = (e: { reason: string; response: string }) => {
    if (!e?.reason && !e?.response) {
      authStore.sipState = 'stopped'
    } else {
      authStore.sipState = 'failure'
      authStore.sipTotalFailure += 1
    }
    window.setTimeout(() => sip.disconnect(), 300)
  }

  onSIPConnectionTimeout = () => {
    authStore.sipState = 'failure'
    authStore.sipTotalFailure += 1
    sip.disconnect()
  }

  onSIPSessionStarted = (call: Call) => {
    const number = call.partyNumber
    if (number === '8') {
      call.partyName = 'Voicemails'
    }
    if (!call.partyName) {
      call.partyName = contactStore.getPBXUser(number)?.name
    }
    callStore.upsertCall(call)
  }
  onSIPSessionUpdated = (call: Call) => {
    callStore.upsertCall(call)
  }
  onSIPSessionStopped = (id: string) => {
    const call = callStore._calls.find(c => c.id === id)
    if (!call) {
      return
    }
    authStore.pushRecentCall({
      id: uuid(),
      incoming: call.incoming,
      answered: call.answered,
      partyName: call.partyName,
      partyNumber: call.partyNumber,
      duration: call.duration,
      created: moment().format('HH:mm - MMM D'),
    })
    callStore.removeCall(call.id)
  }

  onUCConnectionStopped = () => {
    authStore.ucState = 'stopped'
  }

  onUCConnectionTimeout = () => {
    authStore.ucState = 'failure'
    authStore.ucTotalFailure += 1
  }

  onUCUserUpdated = (ev: {
    id: string
    name: string
    avatar: string
    status: string
    statusText: string
  }) => {
    contactStore.updateUCUser(ev)
  }

  onBuddyChatCreated = (chat: {
    id: string
    creator: string
    text?: string
    file?: string
    created: number
  }) => {
    chatStore.pushMessages(chat.creator, chat, true)
  }
  onGroupChatCreated = (chat: {
    id: string
    group: string
    creator: string
    text?: string
    file?: string
    created: number
  }) => {
    chatStore.pushMessages(chat.group, chat, true)
  }

  onChatGroupInvited = (group: {
    id: string
    name: string
    inviter: string
    members: string[]
  }) => {
    chatStore.upsertGroup(group)
  }
  onChatGroupUpdated = (group: {
    id: string
    name: string
    jointed: boolean
    members: string[]
  }) => {
    chatStore.upsertGroup(group)
  }
  onChatGroupRevoked = (group: { id: string }) => {
    chatStore.removeGroup(group.id)
  }

  onFileReceived = (file: {
    id: string
    name: string
    size: number
    incoming: boolean
    state: string
    transferPercent: number
  }) => {
    chatStore.upsertFile(file)
  }
  onFileProgress = (file: {
    id: string
    state: string
    transferPercent: number
  }) => {
    chatStore.upsertFile(file)
  }
  onFileFinished = (file: {
    id: string
    state: string
    transferPercent: number
  }) => {
    chatStore.upsertFile(file)
  }
}

export default new Api()

interface UserTalkerEvent {
  user: string
  talker: string
}
