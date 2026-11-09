import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_UNAUTHORIZED_EVENT,
  ApiError,
  api,
  setCsrfToken,
} from "./client";

const fetchMock = vi.fn();

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () =>
      body === undefined
        ? ""
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  } as Response;
}

function lastRequest(): [string, RequestInit] {
  return fetchMock.mock.calls[0] as [string, RequestInit];
}

describe("api client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setCsrfToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds the CSRF token and JSON headers to mutations", async () => {
    setCsrfToken("csrf-123");
    fetchMock.mockResolvedValue(mockResponse({ id: 1 }, 201));

    await api.post("/assets", { name: "Test" });

    const [url, init] = lastRequest();
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/v1/assets");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-123");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not send the CSRF token on safe requests", async () => {
    setCsrfToken("csrf-123");
    fetchMock.mockResolvedValue(mockResponse([]));

    await api.get("/assets");

    const [, init] = lastRequest();
    const headers = new Headers(init.headers);
    expect(headers.has("X-CSRF-Token")).toBe(false);
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("parses API error details and emits an unauthorized event", async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
    fetchMock.mockResolvedValue(
      mockResponse({ detail: "Not authenticated." }, 401),
    );

    await expect(api.get("/assets")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Not authenticated.",
    });
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
  });

  it("does not emit an unauthorized event for auth endpoints", async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
    fetchMock.mockResolvedValue(
      mockResponse({ detail: "Not authenticated." }, 401),
    );

    await expect(api.get("/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
  });

  it("returns undefined for empty 204 responses", async () => {
    fetchMock.mockResolvedValue(mockResponse(undefined, 204));

    await expect(api.delete("/assets/1")).resolves.toBeUndefined();
  });

  it("falls back to response text for non-JSON errors", async () => {
    fetchMock.mockResolvedValue(
      mockResponse("Bad gateway", 502),
    );

    await expect(api.get("/assets")).rejects.toThrow("Bad gateway");
  });
});
