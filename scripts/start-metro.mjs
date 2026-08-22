#!/usr/bin/env node
/**
 * Starts Expo Metro on the first available port (prefers 8081).
 * Avoids hard-coded --port crashes when 8081 is busy, and skips interactive prompts.
 */
import { createServer, connect } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawArgs = process.argv.slice(2);

function extractPortArg(args) {
  const out = [];
  let explicitPort;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--port' || arg === '-p') {
      const value = Number(args[i + 1]);
      if (Number.isFinite(value) && value > 0) explicitPort = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      const value = Number(arg.slice('--port='.length));
      if (Number.isFinite(value) && value > 0) explicitPort = value;
      continue;
    }
    out.push(arg);
  }
  return { args: out, explicitPort };
}

function canConnect(port, host) {
  return new Promise((resolve) => {
    const socket = connect({ port, host, family: host.includes(':') ? 6 : 4 });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function canBind(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function isPortFree(port) {
  // If anything already accepts connections, the port is taken (covers IPv4/IPv6 Metro).
  if (await canConnect(port, '127.0.0.1')) return false;
  if (await canConnect(port, '::1')) return false;
  // Also require we can bind on common listen addresses used by Metro on Windows.
  if (!(await canBind(port, '0.0.0.0'))) return false;
  if (!(await canBind(port, '::'))) return false;
  return true;
}

async function findAvailablePort(startPort, maxAttempts = 50) {
  const start = Number.isFinite(startPort) && startPort > 0 ? startPort : 8081;
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = start + offset;
    // Skip Android emulator console ports
    if (port >= 5554 && port <= 5585) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free Metro port found near ${start}`);
}

const { args: extraArgs, explicitPort } = extractPortArg(rawArgs);
const preferredPort = Number(
  explicitPort || process.env.RCT_METRO_PORT || process.env.PORT || 8081
);
const port = await findAvailablePort(preferredPort);
process.env.RCT_METRO_PORT = String(port);
// Avoid crashing Metro when Expo API is unreachable (transient network / firewall).
if (!process.env.EXPO_NO_DEPENDENCY_VALIDATION && !process.env.EXPO_OFFLINE) {
  process.env.EXPO_NO_DEPENDENCY_VALIDATION = '1';
}

const expoCli = path.join(projectRoot, 'node_modules', 'expo', 'bin', 'cli');
const args = [expoCli, 'start', ...extraArgs, '--port', String(port)];

console.log(`Starting Expo Metro on port ${port}...`);

const child = spawn(process.execPath, args, {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
  windowsHide: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
