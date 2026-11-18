import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';

import { setStore } from '@/lib/store-ref';

import authReducer from './features/authSlice';
import colleaguesReducer from './features/colleaguesSlice';
import profileReducer from './features/profileSlice';
import tasksReducer from './features/tasksSlice';

const persistConfig = {
  key: 'watney',
  storage: AsyncStorage,
  // Task data is a session cache: it's refreshed on every visit, so don't write it to disk.
  blacklist: ['tasks'],
};

const rootReducer = combineReducers({
  auth: authReducer,
  profile: profileReducer,
  colleagues: colleaguesReducer,
  tasks: tasksReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'persist/REGISTER'],
      },
    }),
});

setStore(store);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

export default store;
