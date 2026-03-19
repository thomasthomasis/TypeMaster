import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { Session } from "@heroiclabs/nakama-js";

export type AuthStatus = 'IDLE' | 'AUTHENTICATING' | 'AUTHENTICATED' | 'ERROR';

interface AuthState {
  session: Session | null;
  isGuest: boolean;
  status: AuthStatus;
}

const initialState: AuthState = {
  session: null,
  isGuest: false,
  status: 'IDLE',
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ session: Session; isGuest?: boolean }>) => {
      state.session = action.payload.session;
      state.status = 'AUTHENTICATED';
      
      // If isGuest is explicitly passed, use it. 
      // Otherwise, we look at the session's vars (Nakama custom metadata)
      state.isGuest = action.payload.isGuest ?? false;
    },
    clearAuth: (state) => {
      state.session = null;
      state.isGuest = false;
      state.status = 'IDLE';
    },
    setStatus: (state, action: PayloadAction<AuthStatus>) => {
      state.status = action.payload;
    }
  },
});

export const { setAuth, clearAuth, setStatus } = authSlice.actions;
export default authSlice.reducer;