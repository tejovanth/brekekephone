import { mdiKeyboardOffOutline, mdiKeyboardOutline } from '@mdi/js'
import { observer } from 'mobx-react'
import React, { FC } from 'react'
import { Keyboard, Platform, StyleSheet } from 'react-native'

import RnKeyboard from '../stores/RnKeyboard'
import AnimatedSize from './AnimatedSize'
import { RnIcon, RnText, RnTouchableOpacity } from './Rn'
import g from './variables'

const css = StyleSheet.create({
  ToggleKeyboard: {
    flexDirection: 'row',
    marginRight: 8,
    marginBottom: 4,
    borderRadius: g.borderRadius,
    paddingVertical: 8,
    width: g.iconSize + 24,
    backgroundColor: g.hoverBg,
    ...g.boxShadow,
  },
  Text: {
    /* Fix button size does not equal with the Actions */
    width: 0,
    lineHeight: g.iconSize,
    overflow: 'hidden',
  },
})

const ToggleKeyboard: FC<{
  onShowKeyboard(): void
}> = observer(({ onShowKeyboard }) => {
  if (
    Platform.OS === 'web' ||
    (!RnKeyboard.isKeyboardShowing && !onShowKeyboard)
  ) {
    return null
  }
  return (
    <AnimatedSize animateWidth>
      <RnTouchableOpacity
        onPress={
          RnKeyboard.isKeyboardShowing ? Keyboard.dismiss : onShowKeyboard
        }
        style={css.ToggleKeyboard}
      >
        {/* Fix button size does not equal with the Actions */}
        <RnText style={css.Text}>{'\u200a'}</RnText>
        <RnIcon
          path={
            RnKeyboard.isKeyboardShowing
              ? mdiKeyboardOffOutline
              : mdiKeyboardOutline
          }
        />
      </RnTouchableOpacity>
    </AnimatedSize>
  )
})

export default ToggleKeyboard
