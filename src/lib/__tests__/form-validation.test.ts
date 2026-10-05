import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import {
  CHECK_FIELDS_MESSAGE,
  FORM_ERROR_KEY,
  FormValidationError,
  hasFieldErrors,
  toFieldErrors,
  validateForm,
} from "../form-validation";
import { loginSchema, registerSchema, resetPasswordSchema } from "../../server/validation/schemas";

describe("toFieldErrors", () => {
  it("keys messages by field path and keeps the first per field", () => {
    const schema = z.object({
      name: z.string().min(1, "Name first").min(3, "Name second"),
      profile: z.object({ age: z.number({ message: "Age" }) }),
    });
    const result = schema.safeParse({ name: "", profile: {} });
    assert.ok(!result.success);
    assert.deepEqual(toFieldErrors(result.error), { name: "Name first", "profile.age": "Age" });
  });

  it("files whole-form issues under the form key", () => {
    const schema = z.object({ a: z.string() }).refine(() => false, { message: "Whole form" });
    const result = schema.safeParse({ a: "x" });
    assert.ok(!result.success);
    assert.deepEqual(toFieldErrors(result.error), { [FORM_ERROR_KEY]: "Whole form" });
  });
});

describe("validateForm with the shared auth schemas", () => {
  it("reports both empty sign-in fields with the server's own copy", () => {
    assert.throws(
      () => validateForm(loginSchema, { email: "", password: "" }),
      (error: unknown) => {
        assert.ok(error instanceof FormValidationError);
        assert.equal(error.message, CHECK_FIELDS_MESSAGE);
        assert.deepEqual(error.fields, {
          email: "Enter your email address.",
          password: "Enter your password.",
        });
        return true;
      },
    );
  });

  it("rejects a malformed email", () => {
    assert.throws(
      () => validateForm(loginSchema, { email: "not-an-email", password: "x" }),
      (error: FormValidationError) => error.fields.email === "That doesn't look like an email address.",
    );
  });

  it("normalises valid input exactly as the API will", () => {
    const parsed = validateForm(loginSchema, { email: "  Alex@Hydra.App ", password: "secret" });
    assert.deepEqual(parsed, { email: "alex@hydra.app", password: "secret" });
  });

  it("enforces the shared password length on registration", () => {
    assert.throws(
      () => validateForm(registerSchema, { name: "Alex", email: "a@b.co", password: "short" }),
      (error: FormValidationError) => error.fields.password === "Use at least 8 characters.",
    );
  });

  it("flags a problem with a value the form doesn't render", () => {
    assert.throws(
      () => validateForm(resetPasswordSchema, { token: "abc", password: "long-enough" }),
      (error: FormValidationError) => typeof error.fields.token === "string" && !error.fields.password,
    );
  });
});

describe("hasFieldErrors", () => {
  it("recognises any error carrying non-empty fields", () => {
    assert.equal(hasFieldErrors(new FormValidationError({ email: "x" })), true);
    assert.equal(hasFieldErrors(Object.assign(new Error("api"), { fields: { a: "b" } })), true);
  });

  it("ignores errors without usable fields", () => {
    assert.equal(hasFieldErrors(new Error("plain")), false);
    assert.equal(hasFieldErrors(Object.assign(new Error("empty"), { fields: {} })), false);
    assert.equal(hasFieldErrors(Object.assign(new Error("null"), { fields: null })), false);
    assert.equal(hasFieldErrors({ fields: { a: "b" } }), false);
  });
});
