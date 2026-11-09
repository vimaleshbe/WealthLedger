import { api, setCsrfToken } from "./client";

export interface AuthSession {
  username: string;
  csrf_token: string;
  expires_at: string;
}

export async function login(
  username: string,
  password: string,
): Promise<AuthSession> {
  const session = await api.post<AuthSession>("/auth/login", {
    username,
    password,
  });
  setCsrfToken(session.csrf_token);
  return session;
}

export async function fetchSession(): Promise<AuthSession> {
  const session = await api.get<AuthSession>("/auth/me");
  setCsrfToken(session.csrf_token);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await api.post<void>("/auth/logout", {});
  } finally {
    setCsrfToken(null);
  }
}
