import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        // Only restore session if it's a fully verified user with a token
        // Reject broken sessions where requiresOtp:true got accidentally stored
        if (parsed && parsed.token && parsed.fullName && parsed.role) {
          setUser(parsed);
        } else {
          // Clear invalid session data
          localStorage.removeItem('user');
        }
      }
    } catch (e) {
      localStorage.removeItem('user');
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    // Only store fully verified users (must have token + fullName + role)
    if (!userData.token || !userData.fullName || !userData.role) {
      console.warn('AuthContext: Refusing to store incomplete user data', userData);
      return;
    }
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
