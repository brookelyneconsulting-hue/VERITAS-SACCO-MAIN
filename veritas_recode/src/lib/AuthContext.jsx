import React, { createContext, useContext, useEffect, useState } from 'react';
import { backend, supabase } from '@/api/backendClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const currentUser = await backend.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error?.status === 401 || error?.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkAppState = async () => {
    setIsLoadingPublicSettings(true);
    await checkUserAuth();
    setIsLoadingPublicSettings(false);
  };

  useEffect(() => {
    let mounted = true;
    checkAppState();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (!session) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return;
      }
      window.setTimeout(() => { void checkUserAuth(); }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    await backend.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.assign('/login');
  };

  const navigateToLogin = () => backend.auth.redirectToLogin(window.location.href);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
