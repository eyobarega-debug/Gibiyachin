import { createContext, useContext, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AuthPromptModal from "../components/AuthPromptModal";

const AuthPromptContext = createContext(null);

export function AuthPromptProvider({ children }) {
  const [promptState, setPromptState] = useState(null);
  const navigate = useNavigate();

  const promptAuth = useCallback((options = {}) => {
    const opts = typeof options === "string" ? { to: options } : options;
    setPromptState({
      open: true,
      to: opts.to || "/",
      title: opts.title || "Sign in to Gibiyachin",
      description:
        opts.description ||
        "Join your campus community to browse verified listings, borrow & rent equipment, and access QR-verified event tickets.",
      badge: opts.badge || "",
    });
  }, []);

  const closePrompt = useCallback(() => {
    setPromptState(null);
  }, []);

  const handleLogin = useCallback(() => {
    const target = promptState?.to;
    closePrompt();
    navigate("/login", {
      state: { from: target && target !== "/" ? { pathname: target } : undefined },
    });
  }, [promptState, navigate, closePrompt]);

  const handleRegister = useCallback(() => {
    const target = promptState?.to;
    closePrompt();
    navigate("/register", {
      state: { from: target && target !== "/" ? { pathname: target } : undefined },
    });
  }, [promptState, navigate, closePrompt]);

  const handleContinueGuest = useCallback(() => {
    const target = promptState?.to;
    closePrompt();
    if (
      target &&
      target !== "/" &&
      !target.startsWith("/login") &&
      !target.startsWith("/register")
    ) {
      navigate(target);
    }
  }, [promptState, navigate, closePrompt]);

  return (
    <AuthPromptContext.Provider value={{ promptAuth, closePrompt }}>
      {children}
      <AuthPromptModal
        open={Boolean(promptState?.open)}
        onClose={closePrompt}
        title={promptState?.title}
        description={promptState?.description}
        badge={promptState?.badge}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onContinueGuest={handleContinueGuest}
      />
    </AuthPromptContext.Provider>
  );
}

export function useAuthPrompt() {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) {
    throw new Error("useAuthPrompt must be used within an AuthPromptProvider");
  }
  return ctx;
}

