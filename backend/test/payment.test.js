/**
 * backend/test/payment.test.js
 *
 * Unit tests for the payment logic of the Powerhouse Gym SGMS.
 * Uses Node's built-in test runner — no extra dependencies needed.
 *
 * Run:
 *   cd "smartgym-system/backend"
 *   node --test test/payment.test.js
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ─── Inline stub: replace with your actual DB/service imports ────────────────
// e.g. import { addPayment, getPayments, validatePayment } from "../services/paymentService.js";

/**
 * Minimal in-memory stub that mirrors the real payment service shape.
 * Delete this block once you wire up the real module.
 */
let _db = [];

function resetDb() {
  _db = [];
}

function addPayment({ memberId, memberName, amount, method, paidAt }) {
  if (!memberId) throw new Error("memberId is required");
  if (!memberName) throw new Error("memberName is required");
  if (typeof amount !== "number" || amount <= 0)
    throw new Error("amount must be a positive number");
  const VALID_METHODS = ["cash", "gcash", "card"];
  if (!VALID_METHODS.includes(method))
    throw new Error(`method must be one of: ${VALID_METHODS.join(", ")}`);
  if (!(paidAt instanceof Date) || isNaN(paidAt))
    throw new Error("paidAt must be a valid Date");

  const payment = {
    id: _db.length + 1,
    memberId,
    memberName,
    amount,
    method,
    paidAt,
  };
  _db.push(payment);
  return payment;
}

function getPayments({ memberId } = {}) {
  if (memberId) return _db.filter((p) => p.memberId === memberId);
  return [..._db];
}

function getPaymentById(id) {
  return _db.find((p) => p.id === id) ?? null;
}

function getTotalRevenue() {
  return _db.reduce((sum, p) => sum + p.amount, 0);
}

function validatePaymentInput({ amount, method }) {
  const errors = [];
  if (typeof amount !== "number" || isNaN(amount)) errors.push("amount must be a number");
  if (amount <= 0) errors.push("amount must be greater than 0");
  const VALID_METHODS = ["cash", "gcash", "card"];
  if (!VALID_METHODS.includes(method))
    errors.push(`method must be one of: ${VALID_METHODS.join(", ")}`);
  return errors;
}
// ─────────────────────────────────────────────────────────────────────────────

// Shared fixture
const SAMPLE_PAYMENT = {
  memberId: "member-001",
  memberName: "Kean",
  amount: 1500,
  method: "cash",
  paidAt: new Date("2026-04-18T10:00:00"),
};

// ── 1. Input validation ───────────────────────────────────────────────────────
describe("validatePaymentInput", () => {
  test("returns no errors for valid cash payment", () => {
    const errors = validatePaymentInput({ amount: 500, method: "cash" });
    assert.deepEqual(errors, []);
  });

  test("returns no errors for valid gcash payment", () => {
    const errors = validatePaymentInput({ amount: 1500, method: "gcash" });
    assert.deepEqual(errors, []);
  });

  test("returns error when amount is zero", () => {
    const errors = validatePaymentInput({ amount: 0, method: "cash" });
    assert.ok(errors.some((e) => e.includes("greater than 0")));
  });

  test("returns error when amount is negative", () => {
    const errors = validatePaymentInput({ amount: -100, method: "cash" });
    assert.ok(errors.some((e) => e.includes("greater than 0")));
  });

  test("returns error when amount is not a number", () => {
    const errors = validatePaymentInput({ amount: "five hundred", method: "cash" });
    assert.ok(errors.some((e) => e.includes("must be a number")));
  });

  test("returns error for unknown payment method", () => {
    const errors = validatePaymentInput({ amount: 500, method: "bitcoin" });
    assert.ok(errors.some((e) => e.includes("method")));
  });

  test("returns multiple errors when both fields are invalid", () => {
    const errors = validatePaymentInput({ amount: -1, method: "paypal" });
    assert.ok(errors.length >= 2);
  });
});

// ── 2. addPayment ─────────────────────────────────────────────────────────────
describe("addPayment", () => {
  beforeEach(() => resetDb());

  test("creates a payment and returns it with an id", () => {
    const payment = addPayment(SAMPLE_PAYMENT);
    assert.ok(payment.id, "should have an id");
    assert.equal(payment.memberId, SAMPLE_PAYMENT.memberId);
    assert.equal(payment.memberName, SAMPLE_PAYMENT.memberName);
    assert.equal(payment.amount, SAMPLE_PAYMENT.amount);
    assert.equal(payment.method, SAMPLE_PAYMENT.method);
    assert.deepEqual(payment.paidAt, SAMPLE_PAYMENT.paidAt);
  });

  test("each new payment gets a unique id", () => {
    const p1 = addPayment(SAMPLE_PAYMENT);
    const p2 = addPayment({ ...SAMPLE_PAYMENT, memberId: "member-002", memberName: "Rick" });
    assert.notEqual(p1.id, p2.id);
  });

  test("throws when memberId is missing", () => {
    assert.throws(
      () => addPayment({ ...SAMPLE_PAYMENT, memberId: undefined }),
      /memberId is required/
    );
  });

  test("throws when memberName is missing", () => {
    assert.throws(
      () => addPayment({ ...SAMPLE_PAYMENT, memberName: "" }),
      /memberName is required/
    );
  });

  test("throws when amount is zero", () => {
    assert.throws(
      () => addPayment({ ...SAMPLE_PAYMENT, amount: 0 }),
      /positive number/
    );
  });

  test("throws when amount is negative", () => {
    assert.throws(
      () => addPayment({ ...SAMPLE_PAYMENT, amount: -500 }),
      /positive number/
    );
  });

  test("throws for unsupported payment method", () => {
    assert.throws(
      () => addPayment({ ...SAMPLE_PAYMENT, method: "paypal" }),
      /method must be one of/
    );
  });

  test("throws when paidAt is not a Date", () => {
    assert.throws(
      () => addPayment({ ...SAMPLE_PAYMENT, paidAt: "2026-04-18" }),
      /valid Date/
    );
  });

  test("accepts gcash as a valid method", () => {
    const payment = addPayment({ ...SAMPLE_PAYMENT, method: "gcash" });
    assert.equal(payment.method, "gcash");
  });

  test("accepts card as a valid method", () => {
    const payment = addPayment({ ...SAMPLE_PAYMENT, method: "card" });
    assert.equal(payment.method, "card");
  });
});

// ── 3. getPayments ────────────────────────────────────────────────────────────
describe("getPayments", () => {
  beforeEach(() => {
    resetDb();
    addPayment(SAMPLE_PAYMENT);                                              // member-001
    addPayment({ ...SAMPLE_PAYMENT, memberId: "member-002", memberName: "Rick", amount: 500 });
    addPayment({ ...SAMPLE_PAYMENT, memberId: "member-001", amount: 500 }); // second for member-001
  });

  test("returns all payments when no filter is given", () => {
    const payments = getPayments();
    assert.equal(payments.length, 3);
  });

  test("filters payments by memberId", () => {
    const payments = getPayments({ memberId: "member-001" });
    assert.equal(payments.length, 2);
    assert.ok(payments.every((p) => p.memberId === "member-001"));
  });

  test("returns empty array for a memberId with no payments", () => {
    const payments = getPayments({ memberId: "member-999" });
    assert.deepEqual(payments, []);
  });

  test("does not mutate the internal store (returns a copy)", () => {
    const payments = getPayments();
    payments.push({ id: 99, fake: true });
    assert.equal(getPayments().length, 3);
  });
});

// ── 4. getPaymentById ─────────────────────────────────────────────────────────
describe("getPaymentById", () => {
  beforeEach(() => {
    resetDb();
    addPayment(SAMPLE_PAYMENT);
  });

  test("returns the correct payment by id", () => {
    const payment = getPaymentById(1);
    assert.ok(payment);
    assert.equal(payment.memberName, "Kean");
  });

  test("returns null for a non-existent id", () => {
    const payment = getPaymentById(999);
    assert.equal(payment, null);
  });
});

// ── 5. getTotalRevenue ────────────────────────────────────────────────────────
describe("getTotalRevenue", () => {
  beforeEach(() => resetDb());

  test("returns 0 when there are no payments", () => {
    assert.equal(getTotalRevenue(), 0);
  });

  test("sums all payment amounts correctly", () => {
    addPayment(SAMPLE_PAYMENT);                                              // ₱1,500
    addPayment({ ...SAMPLE_PAYMENT, memberId: "member-002", memberName: "Rick", amount: 500 });  // ₱500
    addPayment({ ...SAMPLE_PAYMENT, memberId: "member-003", memberName: "Isagani", amount: 500 }); // ₱500
    assert.equal(getTotalRevenue(), 2500);
  });

  test("reflects newly added payments immediately", () => {
    addPayment(SAMPLE_PAYMENT);
    assert.equal(getTotalRevenue(), 1500);
    addPayment({ ...SAMPLE_PAYMENT, memberId: "member-002", memberName: "Rick", amount: 300 });
    assert.equal(getTotalRevenue(), 1800);
  });
});