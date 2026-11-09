import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import axiosInstance from '../../lib/axios';
import { logout } from './authSlice';

export interface Colleague {
  _id: string;
  name: string;
  email?: string;
  role?: string;
  image?: string;
  phone?: string;
}

interface ColleaguesState {
  users: Colleague[];
  loading: boolean;
  error: string | null;
}

const initialState: ColleaguesState = {
  users: [],
  loading: false,
  error: null,
};

/** Everyone in the signed-in user's company (same endpoint the web app's user list uses). */
export const fetchColleagues = createAsyncThunk<Colleague[], string, { rejectValue: string }>(
  'colleagues/fetchColleagues',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/users/company/${userId}`);
      const data = response.data?.data;
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to load colleagues');
    }
  }
);

const colleaguesSlice = createSlice({
  name: 'colleagues',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchColleagues.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchColleagues.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchColleagues.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to load colleagues';
      })
      // Don't show the previous account's team after logging out.
      .addCase(logout.fulfilled, () => initialState);
  },
});

export default colleaguesSlice.reducer;
