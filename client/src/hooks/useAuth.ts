import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';

export const useAuth = () => {
  const session = useSelector((state: RootState) => state.auth.session);
  
  // We check if the session exists and if the token isn't expired
  const isAuthenticated = !!session;

  return {
    isAuthenticated,
    session,
    userId: session?.user_id
  };
};