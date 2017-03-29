"use strict";

//var defer = require('../lib/defer.js');
// ↑ may be better / different than promises (async function)
var codec = require('../lib/object-codec.js');
var sha1 = require('git-sha1');

module.exports = mixin;
var isHash = /^[0-9a-f]{40}$/;

function mixin(repo) {
  var objects = {};
  var refs = {};

  repo.saveAs = saveAs;
  repo.loadAs = loadAs;
  repo.saveRaw = saveRaw;
  repo.loadRaw = loadRaw;
  repo.hasHash = hasHash;
  repo.readRef = readRef;
  repo.updateRef = updateRef;
  repo.listRefs = listRefs;
  repo.enumerateObjects = enumerateObjects;

  async function readRef(ref) {
    return refs[ref];
  }

  async function listRefs(prefix) {
    let out = {};
    for (let name of Object.keys(refs)) {
      if (name.startsWith(prefix + '/')) {
        out[name] = refs[name];
      }
    }
    return out;
  }

  async function updateRef(ref, hash) {
    return refs[ref] = hash;
  }

  async function hasHash(hash) {
    if (!isHash.test(hash)) hash = refs[hash];
    return hash in objects;
  }

  async function saveAs(type, body) {
    let buffer = codec.frame({ type, body });
    let hash = sha1(buffer);
    objects[hash] = buffer;
    return hash;
  }

  async function saveRaw(hash, buffer) {
    return (objects[hash] = buffer) && hash;
  }

  async function loadAs(type, hash) {
    if (!isHash.test(hash)) hash = refs[hash];
    let buffer = objects[hash];
    if (!buffer) return [];
    let obj = codec.deframe(buffer, true);
    if (obj.type !== type) throw new TypeError("Type mismatch");
    return obj.body;
  }

  async function loadRaw(hash) {
    return objects[hash];
  }

  async function enumerateObjects() {
    let hashes = Object.keys(objects);
    return hashes.map(hash => ({ hash, content: objects[hash] }));
  }
}
