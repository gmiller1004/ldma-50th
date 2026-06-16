import assert from "node:assert/strict";
import test from "node:test";
import { parseCartPermalinkLines } from "./parse-cart-permalink";

test("parseCartPermalinkLines parses single line", () => {
  assert.deepEqual(parseCartPermalinkLines("7578846593095:1"), [
    { id: "7578846593095", quantity: 1 },
  ]);
});

test("parseCartPermalinkLines parses multiple lines", () => {
  assert.deepEqual(parseCartPermalinkLines("111:1,222:3"), [
    { id: "111", quantity: 1 },
    { id: "222", quantity: 3 },
  ]);
});

test("parseCartPermalinkLines clamps quantity", () => {
  assert.deepEqual(parseCartPermalinkLines("111:0"), [{ id: "111", quantity: 1 }]);
  assert.deepEqual(parseCartPermalinkLines("111:999"), [{ id: "111", quantity: 100 }]);
});
