import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";

const { signInMock, authState } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  authState: { sessionExpired: false },
}));

vi.mock("../components/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    sessionExpired: authState.sessionExpired,
    signIn: signInMock,
    signOut: vi.fn(),
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLogin(initialEntry = "/assets") {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Login />
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), "admin");
  await user.type(screen.getByLabelText(/^Password$/), "test-password-123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}

describe("Login", () => {
  beforeEach(() => {
    signInMock.mockReset();
    authState.sessionExpired = false;
  });

  it("submits the entered credentials", async () => {
    signInMock.mockResolvedValue(undefined);
    renderLogin();

    await fillAndSubmit();

    expect(signInMock).toHaveBeenCalledWith("admin", "test-password-123");
  });

  it("shows a notice when the previous session expired", () => {
    authState.sessionExpired = true;
    renderLogin();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your session expired",
    );
  });

  it("shows the server error when sign in fails", async () => {
    signInMock.mockRejectedValue(new Error("Invalid username or password."));
    renderLogin();

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password.",
    );
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText(/^Password$/);

    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toBeInTheDocument();
  });

  it("redirects away from /login after success", async () => {
    signInMock.mockResolvedValue(undefined);
    renderLogin("/login");

    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
    });
  });
});
