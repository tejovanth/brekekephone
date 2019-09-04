import immutable from 'immutable';
import pickProps from 'lodash/pick';
import { createModel } from 'redux-model';

const allowedToCreateProps = [
  'videoSessionId',
  'id',
  'incoming',
  'partyName',
  'partyNumber',
  'localVideoEnabled',
  'remoteVideoStreamObject',
  'createdAt',
];

const validateCreatingCall = call => pickProps(call, allowedToCreateProps);

export default createModel({
  prefix: 'runningVideos',

  origin: {
    idsByOrder: [],
    detailMapById: {},
    localVideoEnabledByCallid: {},
  },

  getter: {
    idsByOrder: state => state.idsByOrder,
    detailMapById: state => state.detailMapById,
  },

  action: {
    create: function(state, call) {
      const newState = immutable.on(state)(
        immutable.fset('idsByOrder', ids => [...ids, call.videoSessionId]),
        immutable.vset(
          `detailMapById.${call.videoSessionId}`,
          validateCreatingCall(call),
        ),
      );

      newState.detailMapById[call.videoSessionId].localVideoEnabled =
        state.localVideoEnabledByCallid[call.id];
      return newState;
    },

    update: function(state, ev) {
      if (ev.withVideo) {
        state.localVideoEnabledByCallid[ev.sessionId] = ev.withVideo;
        Object.entries(state.detailMapById).forEach(([k, v]) => {
          const sessionid = v.id;
          if (ev.sessionId !== sessionid) {
            return;
          }
          v.localVideoEnabled = ev.withVideo;
        });
      }

      state = {
        idsByOrder: state.idsByOrder,
        detailMapById: state.detailMapById,
        localVideoEnabledByCallid: state.localVideoEnabledByCallid,
      };

      return state;
    },

    remove: function(state, call) {
      const videoSessionId = call.videoSessionId;

      for (let i = 0; i < state.idsByOrder.length; i++) {
        const vsid = state.idsByOrder[i];

        if (vsid !== videoSessionId) {
          continue;
        }

        state.idsByOrder.splice(i, 1);
        break;
      }

      delete state.detailMapById[videoSessionId];

      state = {
        idsByOrder: state.idsByOrder,
        detailMapById: state.detailMapById,
        localVideoEnabledByCallid: state.localVideoEnabledByCallid,
      };

      return state;
    },

    removeByCallid: function(state, callid) {
      delete state.localVideoEnabledByCallid[callid];

      Object.entries(state.detailMapById).forEach(([k, v]) => {
        if (v.id !== callid) {
          return;
        }
        const tgtVideoSessionId = v.videoSessionId;
        for (let n = 0; n < state.idsByOrder.length; n++) {
          const videoSessionId = state.idsByOrder[n];
          if (videoSessionId === tgtVideoSessionId) {
            state.idsByOrder.splice(n, 1);
            break;
          }
        }
        delete state.detailMapById[k];
      });

      state = {
        idsByOrder: state.idsByOrder,
        detailMapById: state.detailMapById,
        localVideoEnabledByCallid: state.localVideoEnabledByCallid,
      };

      return state;
    },
  },
});
