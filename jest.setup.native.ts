import { jest } from '@jest/globals';

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock')
);
jest.mock('react-native-reanimated', () => {
  const reanimatedMock = require('react-native-reanimated/mock');
  return { ...reanimatedMock, default: { ...reanimatedMock.default, ...reanimatedMock } };
});
