import { hashKey, sha256ToUint64 } from './hash.js';

export class ModuloRouter {
  #nodes;
  #hash;

  constructor(nodes, { hash = sha256ToUint64 } = {}) {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      throw new TypeError('at least one node is required');
    }
    this.#nodes = [...nodes].sort((left, right) => (
      left < right ? -1 : left > right ? 1 : 0
    ));
    if (this.#nodes.some((node) => typeof node !== 'string')) {
      throw new TypeError('modulo router nodes must be strings');
    }
    if (new Set(this.#nodes).size !== this.#nodes.length) {
      throw new TypeError('node IDs must be unique');
    }
    this.#hash = hash;
  }

  primary(key) {
    const index = Number(hashKey(key, this.#hash) % BigInt(this.#nodes.length));
    return this.#nodes[index];
  }

  nodes() {
    return [...this.#nodes];
  }
}
