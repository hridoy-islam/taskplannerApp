// import axios from 'axios';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { getStore } from './store-ref';

// const API_URL = process.env.EXPO_PUBLIC_API_URL;

// const axiosInstance = axios.create({
//   baseURL: API_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Request interceptor
// axiosInstance.interceptors.request.use(
//   async (config) => {
//     const token = await AsyncStorage.getItem('watney');

//     if (token) {
//       config.headers.Authorization = `Bearer ${JSON.parse(token)}`;
//     }

//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// // Refresh token
// const refreshToken = async () => {
//   try {
//     const response = await axios.post(`${API_URL}/auth/refreshToken`);

//     const accessToken = response?.data?.data?.accessToken;

//     if (accessToken) {
//       await AsyncStorage.setItem('watney', JSON.stringify(accessToken));
//       return accessToken;
//     }

//     return null;
//   } catch (error) {
//     await AsyncStorage.removeItem('watney');
//     const { logout: logoutAction } = await import('../redux/features/authSlice');
//     getStore().dispatch(logoutAction());
//     return null;
//   }
// };

// // Response interceptor
// axiosInstance.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const originalRequest = error.config;

//     if (
//       error.response?.status === 401 &&
//       error.response?.data?.message === 'JWT Expired' &&
//       !originalRequest._retry
//     ) {
//       originalRequest._retry = true;

//       const newToken = await refreshToken();

//       if (newToken) {
//         originalRequest.headers.Authorization = `Bearer ${newToken}`;
//         return axiosInstance(originalRequest);
//       }
//     }

//     return Promise.reject(error);
//   }
// );

// export default axiosInstance;









import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getStore } from './store-ref';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// console.log('🔧 API_URL:', API_URL);

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  async (config) => {
    // console.log(`📤 Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    try {
      const token = await AsyncStorage.getItem('watney');
      // console.log('🔑 Token found:', token ? 'Yes' : 'No');

      if (token) {
        const parsedToken = JSON.parse(token);
        config.headers.Authorization = `Bearer ${parsedToken}`;
        // console.log('✅ Token added to headers');
      } else {
        console.log('⚠️ No token found in storage');
      }
    } catch (error) {
      console.error('❌ Error retrieving token from storage:', error);
    }

    // console.log('📋 Request headers:', config.headers);
    // console.log('📦 Request data:', config.data);
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Refresh token
const refreshToken = async () => {
  // console.log('🔄 Attempting to refresh token...');
  
  try {
    const response = await axios.post(`${API_URL}/auth/refreshToken`);
    // console.log('📡 Refresh token response status:', response.status);

    const accessToken = response?.data?.data?.accessToken;
    // console.log('🔑 New access token received:', accessToken ? 'Yes' : 'No');

    if (accessToken) {
      await AsyncStorage.setItem('watney', JSON.stringify(accessToken));
      // console.log('💾 New token saved to storage');
      return accessToken;
    }

    // console.log('⚠️ No access token in refresh response');
    return null;
  } catch (error) {
    console.error('❌ Refresh token failed:', error);
    
    try {
      await AsyncStorage.removeItem('watney');
      // console.log('🗑️ Token removed from storage');
      
      const { logout: logoutAction } = await import('../redux/features/authSlice');
      getStore().dispatch(logoutAction());
      // console.log('👤 User logged out');
    } catch (logoutError) {
      console.error('❌ Error during logout:', logoutError);
    }
    
    return null;
  }
};

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    // console.log(`✅ Response: ${response.status} ${response.config.url}`);
    // console.log('📥 Response data:', response.data);
    return response;
  },
  async (error) => {
    console.error('❌ Response error:', error.message);
    
    const originalRequest = error.config;
    
    // console.log('🔍 Error details:', {
    //   status: error.response?.status,
    //   message: error.response?.data?.message,
    //   url: originalRequest?.url,
    //   method: originalRequest?.method,
    // });

    if (
      error.response?.status === 401 &&
      error.response?.data?.message === 'JWT Expired' &&
      !originalRequest._retry
    ) {
      // console.log('⏰ JWT Expired, attempting refresh...');
      originalRequest._retry = true;

      const newToken = await refreshToken();

      if (newToken) {
        // console.log('✅ Token refreshed successfully, retrying request...');
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } else {
        console.log('❌ Token refresh failed');
      }
    }

    console.log('❌ Request failed:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// console.log('✅ Axios instance configured');

export default axiosInstance;