import React from 'react';
import { StyleSheet, View, Text, Switch } from 'react-native';
import { std } from '../styleguide';

const st = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: std.gap.lg,
    paddingTop: std.gap.md,
    marginBottom: std.gap.md,
    backgroundColor: std.color.shade0,
    borderColor: std.color.shade4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    fontFamily: std.font.text,
    fontSize: std.textSize.sm,
    color: std.color.shade5,
  },
  fieldSwitch: {
    marginLeft: 'auto',
  },
});

const SwitchStatus = p => (
  <View style={st.container}>
    <Text style={st.fieldLabel}>UC STATUS</Text>
    <Switch style={st.fieldSwitch} value={true} />
  </View>
);

export default SwitchStatus;