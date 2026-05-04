import { createContext, useContext, useState, useCallback } from "react";
import { API_BASE_URL } from "../config";

const AuthContext = createContext(null);

// Token stored in module memory — never in localStorage (XSS safe)
let _accessToken  = null;
let _refreshToken = null;

export function getAccessToken()  { return _accessToken; }
export function getRefreshToken() { return _refreshToken; }

export function setTokens(access, refresh) {
  _accessToken  = access;
  _refreshToken = refresh;
}

export function clearTokens() {
  _accessToken  = null;
  _refreshToken = null;
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null); // { user_id, username }
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API_BASE_URL}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");

      setTokens(data.access_token, data.refresh_token);
      setUser({ user_id: data.user_id, username: data.username });
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email, username, password) => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API_BASE_URL}/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");

      setTokens(data.access_token, data.refresh_token);
      setUser({ user_id: data.user_id, username: data.username });
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const rt = getRefreshToken();
      if (rt) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ refresh_token: rt }),
        });
      }
    } catch (_) {}
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
