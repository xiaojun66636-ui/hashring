import assert from "node:assert/strict";
import { test } from "node:test";
import { HashRing, fnv1a } from "../src/ring.ts";

test("a single node owns every key", () => {
  const ring = new HashRing(["only"]);
  assert.equal(ring.locate("a"), "only");
  assert.equal(ring.locate("b"), "only");
});

test("lookup is stable", () => {
  const ring = new HashRing(["a", "b", "c"], { replicas: 16 });
  const first = ["user-1", "user-2", "user-3", "user-4"].map((key) => ring.locate(key));
  const second = ["user-1", "user-2", "user-3", "user-4"].map((key) => ring.locate(key));
  assert.deepEqual(second, first);
});

test("removing a node only moves keys that it owned", () => {
  const ring = new HashRing(["a", "b", "c"], { replicas: 32 });
  const keys = Array.from({ length: 80 }, (_, index) => `key-${index}`);
  const before = new Map(keys.map((key) => [key, ring.locate(key)]));
  ring.remove("b");
  for (const key of keys) {
    const owner = before.get(key);
    if (owner !== "b") assert.equal(ring.locate(key), owner);
    else assert.notEqual(ring.locate(key), "b");
  }
});

test("an injected hash places keys on the clockwise vnode", () => {
  const positions: Record<string, number> = {
    "a#0": 10,
    "b#0": 30,
    "c#0": 50,
    "user-1": 15,
    "user-2": 45,
    "user-3": 55,
  };
  const ring = new HashRing(["a", "b", "c"], {
    replicas: 1,
    hash: (input) => positions[input] ?? 0,
  });
  assert.equal(ring.locate("user-1"), "b");
  assert.equal(ring.locate("user-2"), "c");
  assert.equal(ring.locate("user-3"), "a");
  ring.remove("b");
  assert.equal(ring.locate("user-1"), "c");
  assert.equal(ring.locate("user-2"), "c");
});

test("fnv1a is a stable uint32", () => {
  assert.equal(fnv1a("xiaojun"), fnv1a("xiaojun"));
  assert.equal(fnv1a("xiaojun") >>> 0, fnv1a("xiaojun"));
  assert.notEqual(fnv1a("a"), fnv1a("b"));
});

test("rejects an empty ring lookup and duplicate members", () => {
  const ring = new HashRing<string>();
  assert.throws(() => ring.locate("k"));
  ring.add("a");
  assert.throws(() => ring.add("a"));
  assert.throws(() => ring.remove("missing"));
  assert.throws(() => new HashRing(["a"], { replicas: 0 }));
});
