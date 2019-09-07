import { observer } from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';

import PageRecents from '../../components-Recents/PageRecents';
import authStore from '../../mobx/authStore';
import callStore from '../../mobx/callStore';
import contactStore from '../../mobx/contactStore';
import routerStore from '../../mobx/routerStore';
import Toast from '../../shared/Toast';

@observer
class View extends React.Component {
  static contextTypes = {
    sip: PropTypes.object.isRequired,
  };

  render() {
    return (
      <PageRecents
        resolveCall={this.resolveCall}
        removeCall={authStore.removeRecentCall}
        callBack={this.callBack}
        gotoCallsManage={routerStore.goToCallsManage}
        gotoCallsCreate={routerStore.goToCallsCreate}
        parkingIds={callStore.runnings.filter(c => c.parking).map(c => c.id)}
        resolveUser={this.resolveUser}
        searchText={contactStore.searchText}
        setSearchText={contactStore.setFn('searchText')}
        callIds={this.getMatchUserIds()}
      />
    );
  }

  resolveCall = id => {
    return authStore.profile.recentCalls?.find(c => c.id === id);
  };
  callBack = id => {
    const number = authStore.profile.recentCalls?.find(c => c.id === id)
      ?.partyNumber;
    if (number) {
      this.context.sip.createSession(number);
      routerStore.goToCallsManage();
    } else {
      Toast.error('Could not find number from store to call');
    }
  };

  resolveUser = id => {
    const ucUser = contactStore.getUCUser(id) || {};
    return {
      avatar: ucUser.avatar,
      status: ucUser.status,
    };
  };

  isMatchUser = call => {
    if (call.partyNumber.includes(contactStore.searchText)) {
      return call.id;
    }
  };

  getMatchUserIds = () =>
    authStore.profile.recentCalls.filter(this.isMatchUser).map(c => c.id);
}

export default View;
