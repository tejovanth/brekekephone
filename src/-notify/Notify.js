import { mdiCheck, mdiClose } from '@mdi/js';
import { observer } from 'mobx-react';
import React from 'react';

import { StyleSheet, Text, View } from '../-/Rn';
import g from '../global';
import ButtonIcon from '../shared/ButtonIcon';

const css = StyleSheet.create({
  Notify: {
    flexDirection: `row`,
    alignItems: `center`,
    width: `100%`,
    backgroundColor: g.bg,
    marginBottom: 10,
    alignSelf: `flex-start`,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    ...g.boxShadow,
  },

  Notify_Info: {
    flex: 1,
    paddingLeft: 12,
    paddingVertical: 5,
  },

  Notify_Btn_reject: {
    borderColor: g.colors.danger,
  },
  Notify_Btn_accept: {
    borderColor: g.colors.primary,
  },
  Notify_Info_PartyName: {
    fontSize: 15,
    fontWeight: `bold`,
  },
});

const Notify = observer(p => {
  return (
    <View style={css.Notify}>
      {p.type === `call` && (
        <View style={css.Notify_Info}>
          <Text>
            {p.remoteVideoEnabled
              ? `Incoming video call`
              : `Incoming voice call`}
          </Text>
          <Text style={css.Notify_Info_PartyName}>
            {p.partyName?.toUpperCase()}
          </Text>
          <Text>{p.partyNumber}</Text>
        </View>
      )}
      {p.type === `inviteChat` && (
        <View style={css.Notify_Info}>
          <Text>Group chat invited</Text>
          <Text>{p.name.toUpperCase()}</Text>
          <Text>by{p.inviter}</Text>
        </View>
      )}
      <ButtonIcon
        bdcolor={g.colors.danger}
        color={g.colors.danger}
        onPress={() => p.reject(p.id)}
        path={mdiClose}
        size={30}
        style={css.Notify_Btn_reject}
      />
      <ButtonIcon
        bdcolor={g.colors.primary}
        color={g.colors.primary}
        onPress={() => p.accept(p.id)}
        path={mdiCheck}
        size={30}
        style={css.Notify_Btn_accept}
      />
    </View>
  );
});

export default Notify;
