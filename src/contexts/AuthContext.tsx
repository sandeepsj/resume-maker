import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { setTokenAccessor } from "@/lib/google-drive";

interface User {
  name: string;
  email: string;
  picture: string;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  signIn: () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const SCOPES =
  "openid email profile https://www.googleapis.com/auth/drive.file";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

async function fetchUserInfo(token: string): Promise<User | null> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);
  const pendingSignInResolve = useRef<(() => void) | null>(null);

  // Initialize the token client once GIS script is loaded
  useEffect(() => {
    const initGIS = () => {
      if (!CLIENT_ID || !window.google?.accounts?.oauth2) return;

      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: google.accounts.oauth2.TokenResponse) => {
          if (response.error) {
            console.error("OAuth error:", response.error);
            pendingSignInResolve.current = null;
            return;
          }
          const token = response.access_token;
          sessionStorage.setItem("access_token", token);
          setAccessToken(token);
          const userInfo = await fetchUserInfo(token);
          if (userInfo) {
            setUser(userInfo);
          }
          pendingSignInResolve.current?.();
          pendingSignInResolve.current = null;
        },
      });
    };

    // GIS script may already be loaded or still loading
    if (window.google?.accounts?.oauth2) {
      initGIS();
    } else {
      // Poll for GIS availability (script loads async)
      const interval = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          initGIS();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const restore = async () => {
      const storedToken = sessionStorage.getItem("access_token");
      if (storedToken) {
        const userInfo = await fetchUserInfo(storedToken);
        if (userInfo) {
          setAccessToken(storedToken);
          setUser(userInfo);
        } else {
          // Token expired or invalid
          sessionStorage.removeItem("access_token");
        }
      }
      setIsLoading(false);
    };
    restore();
  }, []);

  // Keep Drive service in sync with the current token
  useEffect(() => {
    setTokenAccessor(() => accessToken);
  }, [accessToken]);

  const signIn = useCallback(() => {
    if (!tokenClientRef.current) {
      console.error("Google Identity Services not initialized. Check VITE_GOOGLE_CLIENT_ID.");
      return;
    }
    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  }, []);

  const signOut = useCallback(() => {
    const token = accessToken || sessionStorage.getItem("access_token");
    if (token) {
      google.accounts.oauth2.revoke(token, () => {});
    }
    sessionStorage.removeItem("access_token");
    setUser(null);
    setAccessToken(null);
  }, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
