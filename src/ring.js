import { createHash } from 'node:crypto';

import {
  HASH_VERSION,
  UINT64_SPACE,
  hashKey,
  hashNodeToken,
  sha256ToUint64,
  tokenHex,
} from './hash.js';

const NODE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_VIRTUAL_NODES = 4096;
const MAX_TOTAL_TOKENS = 1_000_000;

function normalizeNode(raw) {
  const node = typeof raw === 'string' ? { id: raw, weight: 1 } : raw;
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    throw new TypeError('node must be an ID string or { id, weight } object');
  }
  if (typeof node.id !== 'string' || !NODE_ID.test(node.id)) {
    throw new TypeError('node.id must be 1-128 safe identifier characters');
  }
  const weight = node.weight ?? 1;
  if (!Number.isSafeInteger(weight) || weight < 1 || weight > 100) {
    throw new TypeError('node.weight must be an integer between 1 and 100');
  }
  return Object.freeze({ id: node.id, weight });
}

function lowerBound(tokens, target) {
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (tokens[middle].token < target) low = middle + 1;
    else high = middle;
  }
  return low === tokens.length ? 0 : low;
}

export class ConsistentHashRing {
  #nodes;
  #tokens;
  #virtualNodes;
  #hash;
  #hashVersion;
  #fingerprint;

  constructor(rawNodes, {
    virtualNodes = 128,
    hash = sha256ToUint64,
    hashVersion = hash === sha256ToUint64 ? HASH_VERSION : 'custom-test-hash',
  } = {}) {
    if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
      throw new TypeError('at least one node is required');
    }
    if (!Number.isSafeInteger(virtualNodes) || virtualNodes < 1 || virtualNodes > MAX_VIRTUAL_NODES) {
      throw new TypeError(`virtualNodes must be an integer between 1 and ${MAX_VIRTUAL_NODES}`);
    }
    if (typeof hash !== 'function') throw new TypeError('hash must be a function');
    if (typeof hashVersion !== 'string' || !/^[a-z0-9._-]{1,64}$/.test(hashVersion)) {
      throw new TypeError('hashVersion must be a stable 1-64 character identifier');
    }

    const nodes = rawNodes.map(normalizeNode).sort((left, right) => (
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    ));
    const ids = new Set(nodes.map((node) => node.id));
    if (ids.size !== nodes.length) throw new TypeError('node IDs must be unique');

    const totalTokens = nodes.reduce(
      (sum, node) => sum + (virtualNodes * node.weight),
      0,
    );
    if (totalTokens > MAX_TOTAL_TOKENS) {
      throw new TypeError(`ring cannot exceed ${MAX_TOTAL_TOKENS} virtual tokens`);
    }

    const tokens = [];
    for (const node of nodes) {
      for (let replicaIndex = 0; replicaIndex < virtualNodes * node.weight; replicaIndex += 1) {
        tokens.push({
          nodeId: node.id,
          replicaIndex,
          token: hashNodeToken(node.id, replicaIndex, hash),
        });
      }
    }
    tokens.sort((left, right) => {
      if (left.token < right.token) return -1;
      if (left.token > right.token) return 1;
      const byNode = left.nodeId < right.nodeId ? -1 : left.nodeId > right.nodeId ? 1 : 0;
      return byNode !== 0 ? byNode : left.replicaIndex - right.replicaIndex;
    });

    this.#nodes = Object.freeze(nodes);
    this.#tokens = Object.freeze(tokens.map(Object.freeze));
    this.#virtualNodes = virtualNodes;
    this.#hash = hash;
    this.#hashVersion = hashVersion;
    const fingerprint = createHash('sha256')
      .update(`hash\0${hashVersion}\0virtual-nodes\0${virtualNodes}\0`);
    for (const node of nodes) {
      fingerprint.update(`node\0${node.id}\0${node.weight}\0`);
    }
    for (const entry of tokens) {
      fingerprint.update(`token\0${entry.nodeId}\0${entry.replicaIndex}\0${tokenHex(entry.token)}\0`);
    }
    this.#fingerprint = fingerprint.digest('hex');
  }

  locate(key, { replicas = 1 } = {}) {
    if (!Number.isSafeInteger(replicas) || replicas < 1 || replicas > this.#nodes.length) {
      throw new TypeError(`replicas must be between 1 and ${this.#nodes.length}`);
    }
    const keyToken = hashKey(key, this.#hash);
    const start = lowerBound(this.#tokens, keyToken);
    const selected = [];
    const seen = new Set();
    for (let offset = 0; offset < this.#tokens.length && selected.length < replicas; offset += 1) {
      const entry = this.#tokens[(start + offset) % this.#tokens.length];
      if (seen.has(entry.nodeId)) continue;
      seen.add(entry.nodeId);
      selected.push(entry.nodeId);
    }
    return Object.freeze(selected);
  }

  primary(key) {
    return this.locate(key)[0];
  }

  nodes() {
    return this.#nodes.map((node) => ({ ...node }));
  }

  tokenCount() {
    return this.#tokens.length;
  }

  fingerprint() {
    return this.#fingerprint;
  }

  snapshot() {
    return {
      hashVersion: this.#hashVersion,
      fingerprint: this.#fingerprint,
      virtualNodes: this.#virtualNodes,
      tokenCount: this.#tokens.length,
      nodes: this.nodes(),
    };
  }

  ownership() {
    const totals = new Map(this.#nodes.map((node) => [node.id, 0n]));
    const distinct = [];
    for (const entry of this.#tokens) {
      const last = distinct.at(-1);
      if (!last || last.token !== entry.token) distinct.push(entry);
    }

    if (distinct.length === 1) {
      totals.set(distinct[0].nodeId, UINT64_SPACE);
    } else {
      for (let index = 0; index < distinct.length; index += 1) {
        const current = distinct[index];
        const previous = distinct[(index - 1 + distinct.length) % distinct.length];
        const span = current.token > previous.token
          ? current.token - previous.token
          : UINT64_SPACE - previous.token + current.token;
        totals.set(current.nodeId, totals.get(current.nodeId) + span);
      }
    }

    return this.#nodes.map((node) => ({
      nodeId: node.id,
      weight: node.weight,
      share: Number(totals.get(node.id)) / Number(UINT64_SPACE),
    }));
  }

  withNode(node) {
    return new ConsistentHashRing([...this.#nodes, node], {
      virtualNodes: this.#virtualNodes,
      hash: this.#hash,
      hashVersion: this.#hashVersion,
    });
  }

  withoutNode(nodeId) {
    if (!this.#nodes.some((node) => node.id === nodeId)) {
      throw new TypeError(`unknown node: ${nodeId}`);
    }
    if (this.#nodes.length === 1) {
      throw new TypeError('cannot remove the final node');
    }
    return new ConsistentHashRing(
      this.#nodes.filter((node) => node.id !== nodeId),
      {
        virtualNodes: this.#virtualNodes,
        hash: this.#hash,
        hashVersion: this.#hashVersion,
      },
    );
  }
}
