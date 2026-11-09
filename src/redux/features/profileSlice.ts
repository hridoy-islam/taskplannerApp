import { createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../lib/axios';
import { logout } from './authSlice';
import { createSlice } from '@reduxjs/toolkit';

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  image?: string;
}

// Action to fetch user profile
export const fetchUserProfile = createAsyncThunk<UserProfile, string>(
  'profile/fetchUserProfile',
  async (userId) => {
    const response = await axiosInstance.get(`/users/${userId}`);
    return response.data.data;
  }
);
interface UpdateUserProfileArgs {
  userId: string;
  profileData: Partial<UserProfile>;
}

export const updateUserProfile = createAsyncThunk<
  UserProfile,
  UpdateUserProfileArgs,
  { rejectValue: unknown }
>('profile/updateUserProfile', async ({ userId, profileData }, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.patch(`/users/${userId}`, profileData);
    return response.data.data;
  } catch (error: any) {
    // Keep the backend's message so the UI can show it.
    return rejectWithValue(error?.response?.data ?? error?.message);
  }
});

interface ProfileState {
  profileData: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProfileState = {
  profileData: null,
  loading: false,
  error: null
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profileData = action.payload;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      .addCase(updateUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profileData = { ...state.profileData, ...action.payload }; // Update the user with new data
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      // Don't keep the previous account's profile after logging out.
      .addCase(logout.fulfilled, () => initialState);
  }
});

export default profileSlice.reducer;
