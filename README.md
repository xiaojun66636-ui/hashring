# hashring

Consistent hashing with virtual nodes. No dependencies.

A key belongs to the first vnode clockwise from `hash(key)`. Adding or removing a member only remaps keys that used to land on that member. Other keys stay put. That is the property the tests lock in.

## Use

```ts
import { HashRing } from "./src/ring.ts";

const ring = new HashRing(["api-a", "api-b", "api-c"]);
ring.locate("user-42");

ring.add("api-d");
ring.remove("api-b");
```

The default hash is FNV-1a 32-bit, so placement is stable across processes. Pass `hash` in tests when you want to put vnodes on exact numbers. `replicas` defaults to 64. One replica per node is legal, and it is also how a hot node appears: too few vnodes and the arcs are uneven.

## Cost

Lookup is a binary search, O(log (nodes * replicas)). A membership change sorts the ring again. That is the right trade when the member set is small and changes rarely. A tree map would win if members churned constantly.

## Test

```bash
node --experimental-strip-types --test test/*.test.ts
```

## License

MIT
