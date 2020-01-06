import { mdiKeyboardOffOutline, mdiKeyboardOutline } from '@mdi/js';
import { observer } from 'mobx-react';
import React from 'react';

import g from '../../global';
import AnimatedSize from '../../shared/AnimatedSize';
import {
  Icon,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from '../Rn';

const css = StyleSheet.create({
  ToggleKeyboard: {
    flexDirection: `row`,
    marginLeft: 8,
    borderRadius: g.borderRadius,
    paddingVertical: 8,
    width: g.iconSize + 24,
    backgroundColor: g.hoverBg,
  },
  Text: {
    /* Fix button size does not equal with the Actions */
    width: 0,
    lineHeight: g.iconSize,
    overflow: `hidden`,
  },
});

const ToggleKeyboard = observer(({ onShowKeyboard }) => {
  if (Platform.OS === `web` || (!g.isKeyboardShowing && !onShowKeyboard)) {
    return null;
  }
  return (
    <AnimatedSize animateWidth>
      <TouchableOpacity
        onPress={g.isKeyboardShowing ? Keyboard.dismiss : onShowKeyboard}
        style={css.ToggleKeyboard}
      >
        {/* Fix button size does not equal with the Actions */}
        <Text style={css.Text}>{`\u200a`}</Text>
        <Icon
          path={
            g.isKeyboardShowing ? mdiKeyboardOffOutline : mdiKeyboardOutline
          }
        />
      </TouchableOpacity>
    </AnimatedSize>
  );
});

export default ToggleKeyboard;
