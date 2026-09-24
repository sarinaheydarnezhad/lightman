import { useState } from 'react';
import { View } from 'react-native';

/** Jest runs without the native worklets runtime; behavior tests use logical state. */
export const useReducedMotion = jest.fn(() => false);
export const useSharedValue = <T>(initial: T) => useState(() => ({ value: initial }))[0];
export const useAnimatedStyle = <T>(style: () => T) => style();
export const withTiming = jest.fn(<T>(value: T) => value);
export const Easing = { cubic: (value: number) => value, inOut: <T>(easing: T) => easing };

export default { View, createAnimatedComponent: <T>(Component: T) => Component };
