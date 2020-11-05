import { computed } from 'mobx'
import { observer } from 'mobx-react'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import uc from '../api/uc'
import UserItem from '../components/ContactUserItem'
import Field from '../components/Field'
import Layout from '../components/Layout'
import { RnText, RnTouchableOpacity } from '../components/Rn'
import g from '../components/variables'
import chatStore from '../stores/chatStore'
import contactStore from '../stores/contactStore'
import intl, { intlDebug } from '../stores/intl'
import Nav from '../stores/Nav'
import RnAlert from '../stores/RnAlert'

const css = StyleSheet.create({
  PageChatGroupInvite: {},
  PageChatGroupInvite_TextInput: {
    padding: 10,
    ...g.boxShadow,
  },
  PageChatGroupInvite_Outer: {
    paddingTop: 5,
    paddingHorizontal: 10,
  },
  PageChatGroupInvite_BtnSave: {
    marginTop: 15,
    padding: 10,
    borderRadius: g.borderRadius,
    backgroundColor: g.colors.primary,
  },
  PageChatGroupInvite_BtnText: {
    alignItems: 'center',
  },
  PageChatGroupInvite_GroupName: {
    fontSize: g.fontSizeTitle,
    padding: 5,
  },
  PageChatGroupInvite_Text: {
    paddingTop: 15,
    fontSize: g.fontSizeTitle,
  },
})

@observer
class PageChatGroupInvite extends React.Component<{
  groupId: string
}> {
  @computed get buddyIds() {
    return contactStore.ucUsers.map(u => u.id).filter(this.isNotMember)
  }
  state = {
    selectedBuddy: {},
  }

  render() {
    return (
      <Layout onBack={this.back} title={intl`Inviting Group Member`}>
        <View style={css.PageChatGroupInvite_Outer}>
          <RnText style={css.PageChatGroupInvite_GroupName}>
            {chatStore.getGroup(this.props.groupId).name}
          </RnText>
          <RnTouchableOpacity
            onPress={this.invite}
            style={css.PageChatGroupInvite_BtnSave}
          >
            <RnText
              style={css.PageChatGroupInvite_BtnText}
            >{intl`Invite`}</RnText>
          </RnTouchableOpacity>
          <RnText style={css.PageChatGroupInvite_Text}>{intl`Members`}</RnText>
        </View>
        <Field isGroup />
        {this.buddyIds.map((id, i) => (
          <RnTouchableOpacity key={i} onPress={() => this.toggleBuddy(id)}>
            <UserItem
              key={id}
              {...this.resolveBuddy(id)}
              selected={this.state.selectedBuddy[id]}
            />
          </RnTouchableOpacity>
        ))}
      </Layout>
    )
  }

  isNotMember = buddy =>
    !chatStore.getGroup(this.props.groupId).members?.includes(buddy)
  resolveBuddy = buddy => contactStore.getUCUser(buddy)
  toggleBuddy = buddy => {
    let { selectedBuddy } = this.state
    selectedBuddy = {
      ...selectedBuddy,
      [buddy]: !selectedBuddy[buddy],
    }
    this.setState({
      selectedBuddy,
    })
  }

  invite = () => {
    const { selectedBuddy } = this.state
    const members = Object.keys(selectedBuddy)
    if (!members.length) {
      RnAlert.error({
        message: intlDebug`No buddy selected`,
      })
      return
    }
    uc.inviteChatGroupMembers(this.props.groupId, members)
      .catch(this.onInviteFailure)
      .then(this.back)
  }
  onInviteFailure = err => {
    RnAlert.error({
      message: intlDebug`Failed to invite group chat`,
      err,
    })
  }
  back = () => {
    Nav().backToPageChatGroupDetail({ groupId: this.props.groupId })
  }
}

export default PageChatGroupInvite