#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patterns = [
  /BEGIN PRIVATE KEY/, 
  /-----BEGIN RSA PRIVATE KEY-----/, 
  /AKIA[0-9A-Z]{16}/,
];

const ignoreDirs = new Set(['.git', 'node_modules', 'offline-packages']);

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.isFile()) inspect(full);
  }
}

function inspect(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch { return; }
  const text = buf.toString('utf8');
  for (const re of patterns) {
    if (re.test(text)) {
      console.error(`Secret pattern match: ${re} in ${path.relative(root, file)}`);
      process.exitCode = 1;
      return;
    }
  }
}

walk(root);
if (process.exitCode) process.exit(1);
console.log('secret scan ok');
