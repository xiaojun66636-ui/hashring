export type HashFn = (input: string) => number;

export type HashRingOptions = {
  /** Virtual nodes per member. Default 64. */
  replicas?: number;
  /** Maps a string to a uint32. Default is FNV-1a. */
  hash?: HashFn;
};

type Point<T> = { hash: number; node: T };

/** FNV-1a, 32-bit. Stable across processes, no dependency. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Consistent hash ring. A key is owned by the first virtual node clockwise
 * from its hash. Adding or removing a member only moves keys that previously
 * landed in that member's arcs.
 *
 * Membership changes sort the ring again. Lookup is a binary search.
 */
export class HashRing<T extends string> {
  private readonly replicas: number;
  private readonly hash: HashFn;
  private readonly members: T[] = [];
  private points: Point<T>[] = [];

  constructor(nodes: readonly T[] = [], options: HashRingOptions = {}) {
    const replicas = options.replicas ?? 64;
    if (!Number.isInteger(replicas) || replicas < 1) {
      throw new Error("replicas must be an integer >= 1");
    }
    this.replicas = replicas;
    this.hash = options.hash ?? fnv1a;
    for (const node of nodes) this.add(node);
  }

  get size(): number {
    return this.members.length;
  }

  nodes(): T[] {
    return this.members.slice();
  }

  add(node: T): void {
    if (typeof node !== "string" || node.length === 0) {
      throw new Error("node must be a non-empty string");
    }
    if (this.members.includes(node)) {
      throw new Error(`node already on the ring: ${node}`);
    }
    this.members.push(node);
    this.rebuild();
  }

  remove(node: T): void {
    const index = this.members.indexOf(node);
    if (index < 0) throw new Error(`node is not on the ring: ${node}`);
    this.members.splice(index, 1);
    this.rebuild();
  }

  locate(key: string): T {
    if (this.points.length === 0) throw new Error("ring has no nodes");
    const hash = this.hash(key) >>> 0;
    let lo = 0;
    let hi = this.points.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const point = this.points[mid];
      if (!point || point.hash < hash) lo = mid + 1;
      else hi = mid;
    }
    return (this.points[lo] ?? this.points[0]).node;
  }

  private rebuild() {
    const points: Point<T>[] = [];
    for (const node of this.members) {
      for (let replica = 0; replica < this.replicas; replica++) {
        points.push({
          hash: this.hash(`${node}#${replica}`) >>> 0,
          node,
        });
      }
    }
    points.sort((left, right) => left.hash - right.hash || compareText(left.node, right.node));
    this.points = points;
  }
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
