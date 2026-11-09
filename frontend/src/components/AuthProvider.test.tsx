import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_UNAUTHORIZED_EVENT } from "../api/client";
import { AuthProvider, useAuth } from "./AuthProvider";

const { fetchSessionMock, loginMock, logoutMock } = vi.hoisted(() => ({
  fetchSessionMock: vi.fn(),
  loginMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock("../api/auth", () => ({
  fetchSession: fetchSessionMock,
  login: loginMock,
  logout: logoutMock,
}));

const SESSION = {
  username: "admin",
  csrf_token: "csrf-token",
  expires_at: "2030-01-01T00:00:00Z",
};

function AuthProbe() {
  const { user, loading, sessionExpired, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.username ?? "none"}</span>
      <span data-testid="expired">{String(sessionExpired)}</span>
      <button onClick={() => void signIn("admin", "test-password-123")}>login</button>
      <button onClick={() => void signOut()}>logout</button>
    </div>
  );
}

function renderAuthProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe("AuthProvider", () => {
  beforeEach(() => {
    fetchSessionMock.mockReset();
    loginMock.mockReset();
    logoutMock.mockReset();
  });

  it("loads the current session on mount", async () => {
    fetchSessionMock.mockResolvedValue(SESSION);
    renderAuthProvider();

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("admin");
    });
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("falls back to signed out when there is no session", async () => {
    fetchSessionMock.mockRejectedValue(new Error("401"));
    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("signs in and exposes the session", async () => {
    fetchSessionMock.mockRejectedValue(new Error("401"));
    loginMock.mockResolvedValue(SESSION);
    const user = userEvent.setup();
    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("admin");
    });
    expect(loginMock).toHaveBeenCalledWith("admin", "test-password-123");
  });

  it("clears the session and query cache on unauthorized responses", async () => {
    fetchSessionMock.mockResolvedValue(SESSION);
    const { queryClient } = renderAuthProvider();
    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("admin");
    });
    queryClient.setQueryData(["private"], { value: 1 });

    act(() => {
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("none");
    });
    expect(screen.getByTestId("expired")).toHaveTextContent("true");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("signs out locally even if the server call fails", async () => {
    fetchSessionMock.mockResolvedValue(SESSION);
    logoutMock.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    renderAuthProvider();
    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("admin");
    });

    await user.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("none");
    });
    expect(logoutMock).toHaveBeenCalled();
  });
});
