import { View } from 'native-base';
import React from 'react';
import { Platform, StatusBar, StyleSheet } from 'react-native';
import { getStatusBarHeight } from 'react-native-iphone-x-helper';

import registerStyle from './registerStyle';
import v from './variables';

registerStyle(v => ({
  View: {
    MyStatusBar: {
      backgroundColor: v.brekekeShade3,
      borderColor: v.brekekeShade4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      ...Platform.select({
        ios: {
          height: getStatusBarHeight(true),
        },
      }),
      '.transparent': {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      },
    },
  },
}));

const MyStatusBar = p =>
  Platform.OS === 'web' ? null : (
    <View MyStatusBar transparent={p.transparent}>
      <StatusBar
        backgroundColor={p.transparent ? 'transparent' : v.brekekeShade3}
        barStyle="dark-content"
      />
    </View>
  );

export default MyStatusBar;