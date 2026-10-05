import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isHttpsRequest, parseSecureCookieMode, shouldUseSecureCookies } from "../cookie-policy";

describe("parseSecureCookieMode", () => {
  it("defaults to auto when unset or blank", () => {
    assert.equal(parseSecureCookieMode(undefined), "auto");
    assert.equal(parseSecureCookieMode(""), "auto");
    assert.equal(parseSecureCookieMode("   "), "auto");
  });

  it("accepts the named modes and boolean aliases, case-insensitively", () => {
    assert.equal(parseSecureCookieMode("auto"), "auto");
    assert.equal(parseSecureCookieMode("ALWAYS"), "always");
    assert.equal(parseSecureCookieMode("true"), "always");
    assert.equal(parseSecureCookieMode(" never "), "never");
    assert.equal(parseSecureCookieMode("False"), "never");
  });

  it("rejects anything else, so a typo fails at boot", () => {
    assert.throws(() => parseSecureCookieMode("yes"), /AUTH_COOKIE_SECURE/);
    assert.throws(() => parseSecureCookieMode("1"), /AUTH_COOKIE_SECURE/);
  });
});

describe("isHttpsRequest", () => {
  it("reads the protocol the browser used", () => {
    assert.equal(isHttpsRequest("https"), true);
    assert.equal(isHttpsRequest("HTTPS"), true);
    assert.equal(isHttpsRequest("http"), false);
  });

  it("uses the first entry of a proxy chain", () => {
    assert.equal(isHttpsRequest("https, http"), true);
    assert.equal(isHttpsRequest("http,https"), false);
  });

  it("treats a missing header as plain HTTP", () => {
    assert.equal(isHttpsRequest(null), false);
    assert.equal(isHttpsRequest(undefined), false);
    assert.equal(isHttpsRequest(""), false);
  });
});

describe("shouldUseSecureCookies", () => {
  it("follows the request in auto mode", () => {
    assert.equal(shouldUseSecureCookies("auto", "https"), true);
    // The regression: a production build served over HTTP on a LAN address.
    assert.equal(shouldUseSecureCookies("auto", "http"), false);
  });

  it("is pinned by always and never, whatever the request", () => {
    assert.equal(shouldUseSecureCookies("always", "http"), true);
    assert.equal(shouldUseSecureCookies("never", "https"), false);
  });
});
