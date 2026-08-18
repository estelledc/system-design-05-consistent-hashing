import { hashKey, tokenHex } from './hash.js';
import { ConsistentHashRing } from './ring.js';
import { simulateAddition, simulateRemoval } from './simulation.js';

class CliError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function parseFlags(args) {
  const flags = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new CliError('INVALID_ARGUMENT', `expected --name value, received ${name ?? 'end'}`);
    }
    if (flags.has(name)) throw new CliError('INVALID_ARGUMENT', `duplicate flag: ${name}`);
    flags.set(name, value);
  }
  return flags;
}

function requireFlag(flags, name) {
  const value = flags.get(name);
  if (value === undefined) throw new CliError('MISSING_ARGUMENT', `${name} is required`);
  return value;
}

function integerFlag(flags, name, defaultValue, { min, max }) {
  const raw = flags.get(name);
  if (raw === undefined) return defaultValue;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new CliError('INVALID_ARGUMENT', `${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function parseNode(raw) {
  const match = /^([A-Za-z0-9][A-Za-z0-9._-]{0,127})(?::([1-9][0-9]?|100))?$/.exec(raw);
  if (!match) throw new CliError('INVALID_ARGUMENT', `invalid node: ${raw}`);
  return { id: match[1], weight: Number(match[2] ?? 1) };
}

function parseNodes(raw) {
  const nodes = raw.split(',').filter(Boolean).map(parseNode);
  if (nodes.length === 0) throw new CliError('INVALID_ARGUMENT', 'at least one node is required');
  return nodes;
}

function rejectUnknown(flags, allowed) {
  for (const flag of flags.keys()) {
    if (!allowed.has(flag)) throw new CliError('UNKNOWN_ARGUMENT', `unknown flag: ${flag}`);
  }
}

function help() {
  return {
    commands: {
      locate: 'locate --nodes a,b,c --key order-42 [--replicas 2] [--vnodes 128]',
      ring: 'ring --nodes a,b:2,c [--vnodes 128]',
      simulate: 'simulate --nodes a,b,c,d (--add e | --remove d) [--keys 100000] [--seed 42] [--vnodes 128]',
    },
    nodeSyntax: 'node-id or node-id:integer-weight',
  };
}

export function execute(argv) {
  const [command = 'help', ...rest] = argv;
  if (command === 'help' || command === '--help') return { command: 'help', result: help() };
  const flags = parseFlags(rest);
  const virtualNodes = integerFlag(flags, '--vnodes', 128, { min: 1, max: 4096 });

  if (command === 'locate') {
    rejectUnknown(flags, new Set(['--nodes', '--key', '--replicas', '--vnodes']));
    const nodes = parseNodes(requireFlag(flags, '--nodes'));
    const key = requireFlag(flags, '--key');
    const replicas = integerFlag(flags, '--replicas', 1, { min: 1, max: nodes.length });
    const ring = new ConsistentHashRing(nodes, { virtualNodes });
    return {
      command,
      result: {
        key,
        keyToken: tokenHex(hashKey(key)),
        owners: ring.locate(key, { replicas }),
        ring: ring.snapshot(),
      },
    };
  }

  if (command === 'ring') {
    rejectUnknown(flags, new Set(['--nodes', '--vnodes']));
    const ring = new ConsistentHashRing(parseNodes(requireFlag(flags, '--nodes')), { virtualNodes });
    return {
      command,
      result: { ring: ring.snapshot(), ownership: ring.ownership() },
    };
  }

  if (command === 'simulate') {
    rejectUnknown(flags, new Set(['--nodes', '--add', '--remove', '--keys', '--seed', '--vnodes']));
    const nodes = parseNodes(requireFlag(flags, '--nodes'));
    const add = flags.get('--add');
    const remove = flags.get('--remove');
    if (Boolean(add) === Boolean(remove)) {
      throw new CliError('INVALID_ARGUMENT', 'provide exactly one of --add or --remove');
    }
    const keyCount = integerFlag(flags, '--keys', 100_000, { min: 1, max: 1_000_000 });
    const seed = flags.get('--seed') ?? '42';
    const result = add
      ? simulateAddition({ nodes, addedNode: parseNode(add), virtualNodes, keyCount, seed })
      : simulateRemoval({ nodes, removedNodeId: remove, virtualNodes, keyCount, seed });
    return { command, result };
  }

  throw new CliError('UNKNOWN_COMMAND', `unknown command: ${command}`);
}

export function runCli(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  try {
    const response = execute(argv);
    stdout.write(`${JSON.stringify({ ok: true, ...response })}\n`);
    return 0;
  } catch (error) {
    const code = error instanceof CliError ? error.code : 'INVALID_INPUT';
    stderr.write(`${JSON.stringify({
      ok: false,
      error: { code, message: error instanceof Error ? error.message : 'unknown error' },
    })}\n`);
    return 1;
  }
}
