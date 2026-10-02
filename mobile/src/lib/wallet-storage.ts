import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  createMemoryWalletStorage,
  createSecureWalletStorage,
  type WalletStorage,
} from './storage';

/** Expo Go belum mendukung requireAuthentication (lihat dokumentasi expo-secure-store). */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Penyimpanan wallet untuk platform ini. */
export const walletStorage: WalletStorage =
  Platform.OS === 'web'
    ? createMemoryWalletStorage(AsyncStorage)
    : createSecureWalletStorage(SecureStore, { allowBiometricBinding: !isExpoGo });
