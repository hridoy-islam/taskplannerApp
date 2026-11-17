import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Platform } from 'react-native';

import axiosInstance, { clearAuthTokens, saveAuthTokens } from '../../lib/axios';

interface UserCredentials {
  email: string;
  password: string;
}

interface forgetCredentials {
  email: string;
}

interface validateOtpCredentials {
  email: string;
  otp: string;
}

interface ChangePasswordCredentials {
  userId: string;
  token: string;
  password: string;
}

interface ChangePasswordResponse {
  message?: string;
}

interface GoogleUserCredentials {
  googleUid: string;
  name: string;
  email: string;
  image?: string;
  phone?: string;
}

interface AuthState {
  user: any | null;
  token: any | null;
  loading: boolean;
  error: any | null;
  isCompleted?: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  isCompleted: false
};

interface RegisterCredentials {
  email: string;
  password: string;
  role?: string;
  name: string;
  phone?: string;
}

// Define the response type for registration
interface RegisterResponse {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface UserResponse {
  success: boolean;
  message?: string;
  data?: object;
}

interface ForgetResponse {
  message?: string;
}

interface ValidateOtpResponse {
  success: boolean;
  message?: string;
  data?: object;
}

export const registerUser = createAsyncThunk<
  RegisterResponse,
  RegisterCredentials,
  { rejectValue: any }
>('auth/register', async (userCredentials, { rejectWithValue }) => {
  try {
    const request = await axiosInstance.post(`/auth/signup`, userCredentials);
    return request.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

// Async thunk for logging in a user
export const loginUser = createAsyncThunk<UserResponse, UserCredentials, { rejectValue: any }>(
  'auth/login',
  async (userCredentials, { rejectWithValue }) => {
    try {
      const request = await axiosInstance.post('/auth/login', userCredentials);
      const response = await request.data;
      await saveAuthTokens(response.data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const authWithFbORGoogle = createAsyncThunk<
  UserResponse,
  GoogleUserCredentials,
  { rejectValue: any }
>('auth/google', async (googleUserCredentials, { rejectWithValue }) => {
  try {
    const request = await axiosInstance.post('/auth/google', googleUserCredentials);
    const response = await request.data;
    await saveAuthTokens(response.data);
    return response;
  } catch (error: any) {
    return rejectWithValue(error.response?.data || error.message);
  }
});
// forgot password

export const requestOtp = createAsyncThunk<
  ForgetResponse,
  forgetCredentials,
  { rejectValue: any }
>('auth/forget', async (userCredentials, { rejectWithValue }) => {
  try {
    const request = await axios.patch(
      `${process.env.EXPO_PUBLIC_API_URL}/auth/forget`,
      userCredentials,
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json' //this line solved cors
        }
      }
    );
    return request.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

// validate request OTP
export const validateRequestOtp = createAsyncThunk<
  ValidateOtpResponse,
  validateOtpCredentials,
  { rejectValue: any }
>('auth/validate', async (userCredentials, { rejectWithValue }) => {
  try {
    const request = await axios.patch(
      `${process.env.EXPO_PUBLIC_API_URL}/auth/validate`,
      userCredentials,
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json' //this line solved cors
        }
      }
    );
    return request.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

export const verifyEmail = createAsyncThunk<any, { email: string; otp: string }, { rejectValue: any }>(
  'auth/verifyEmail',
  async ({ email, otp }: { email: string; otp: string }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
    `${process.env.EXPO_PUBLIC_API_URL}/auth/verifyemail`, { email, otp });
      // Verifying returns both tokens; keep them so later requests are authorised and can refresh.
      if (response.data?.data) await saveAuthTokens(response.data.data);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

// patch new password
export const changePassword = createAsyncThunk<
  ChangePasswordResponse,
  ChangePasswordCredentials,
  { rejectValue: any }
>('auth/reset', async (userCredentials, { rejectWithValue }) => {
  try {
    const request = await axios.patch(
      `${process.env.EXPO_PUBLIC_API_URL}/auth/reset`,
      userCredentials,
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json', //this line solved cors
          // Authorization: `Bearer ${userCredentials.token}`
        }
      }
    );
    const response = await request.data;

    return response;
  } catch (error: any) {
    return rejectWithValue(error.response?.data || error.message);
  }
});


export const resendOtp = createAsyncThunk<any, { email: string }, { rejectValue: any }>(
  'auth/resendOtp',
  async ({ email}: { email: string}, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
    `${process.env.EXPO_PUBLIC_API_URL}/auth/resend-otp`, { email });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

/**
 * Saves the "Complete your profile" answers and marks the account as authorized
 * (same endpoint and payload as the website's personal-details page).
 */
export const completePersonalInformation = createAsyncThunk<
  any,
  { userId: string; profileData: Record<string, unknown> },
  { rejectValue: any }
>('auth/personalInformation', async ({ userId, profileData }, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.patch(`/auth/users/${userId}`, { ...profileData, authorized: true });
    return response.data?.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

export const logout = createAsyncThunk<void>('user/logout', async () => {
  await clearAuthTokens();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetError(state) {
      state.error = null; // Reset the error state
    },
    updateAuthIsCompleted: (state, action) => {
      state.user.isCompleted = action.payload;
    },
    updateAuthIsValided: (state, action) => {
      state.user.isValided = action.payload;
    },
    updateAuthIsAuthorized: (state, action) => {
      state.user.authorized = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.user = null;
        state.error = null;
        state.token = null;
      })
      .addCase(loginUser.fulfilled, (state, action: any) => {
        state.loading = false;
        state.token = action.payload.data.accessToken;
        const decodedUser = jwtDecode(action.payload.data.accessToken);

        // Create a mutable copy of the decoded user
        const userWithPrivileges = { ...decodedUser };

     

        state.user = userWithPrivileges;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.error = action.payload?.message || action.payload || action.error.message || 'Login failed';
        state.token = null;
      })
      .addCase(authWithFbORGoogle.pending, (state) => {
        state.loading = true;
        state.user = null;
        state.error = null;
        state.token = null;
      })
      .addCase(authWithFbORGoogle.fulfilled, (state, action: any) => {
        state.loading = false;
        state.token = action.payload.data.accessToken;
        const decodedUser = jwtDecode(action.payload.data.accessToken);

        // Create a mutable copy of the decoded user
        const userWithPrivileges = { ...decodedUser };

        // Assign privileges if they exist in the response (only for staff)
      

        state.user = userWithPrivileges;
        state.error = null;
      })
      .addCase(authWithFbORGoogle.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.error = 'Please Check Your Login Credentials';
        state.token = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.user = null; // Clear user state on logout
        state.error = null;
        state.token = null;
      }).addCase(changePassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to change password';
      }).addCase(verifyEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        const { accessToken } = action.payload.data;
        const decoded = jwtDecode(accessToken);
        
        state.loading = false;
        state.token = accessToken;
        // Keep what the login token knew (e.g. authorized, company) — the verify token carries fewer fields.
        state.user = {
          ...state.user,
          ...decoded,
          isValided: true
        };
        state.error = null;
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Verification failed';
      })
      .addCase(completePersonalInformation.fulfilled, (state) => {
        if (state.user) state.user = { ...state.user, authorized: true };
      })
      
  }
});

export const { resetError ,updateAuthIsCompleted, updateAuthIsValided, updateAuthIsAuthorized} = authSlice.actions;
export default authSlice.reducer;
