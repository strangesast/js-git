"use strict";
/*global indexedDB*/

var codec = require('../lib/object-codec.js');
var sha1 = require('git-sha1');
var modes = require('../lib/modes.js');
var db;

mixin.init = init;

mixin.loadAs = loadAs;
mixin.saveAs = saveAs;
module.exports = mixin;

function init(name, version) {
  return new Promise((resolve, reject) => {
    db = null;
    let request = indexedDB.open(name, version);

    // We can only create Object stores in a versionchange transaction.
    request.onupgradeneeded = (evt) => {
      db = evt.target.result;

      if (evt.dataLoss && evt.dataLoss !== 'none') {
        return reject(new Error(evt.dataLoss + ': ' + evt.dataLossMessage));
      }

      // A versionchange transaction is started automatically.
      evt.target.transaction.onerror = (evt) => {
        reject(evt.target.error);
      };

      if (db.objectStoreNames.contains('objects')) {
        db.deleteObjectStore('objects');
      }
      if (db.objectStoreNames.contains('refs')) {
        db.deleteObjectStore('refs');
      }

      db.createObjectStore('objects', { keyPath: 'hash' });
      db.createObjectStore('refs', { keyPath: 'path' });
    };

    request.onsuccess = (evt) => resolve(db = evt.target.result);
    request.onerror = (evt) => reject(evt.target.error);
  });
}


function mixin(repo, prefix) {
  if (!prefix) throw new Error('Prefix required');
  repo.refPrefix = prefix;
  repo.saveAs = saveAs;
  repo.loadAs = loadAs;
  repo.readRef = readRef;
  repo.updateRef = updateRef;
  repo.hasHash = hasHash;
}

function saveAs(type, body, forcedHash) {
  return new Promise((resolve, reject) => {
    let hash;
    try {
      let buffer = codec.frame({type:type,body:body});
      hash = forcedHash || sha1(buffer);
    } catch (err) {
      return reject(err);
    }
    let trans = db.transaction(['objects'], 'readwrite');
    let store = trans.objectStore('objects');
    let entry = { hash: hash, type: type, body: body };
    let request = store.put(entry);

    request.onsuccess = () => {
      resolve({ hash, body });
    };

    request.onerror = (evt) => {
      reject(new Error(evt.value));
    };
  });
}

async function loadAs(type, hash) {
  let entry = await loadRaw(hash);
  if (!entry) return null;
  if (type !== entry.type) {
    throw new TypeError('Type mismatch');
  }
  return entry && entry.body;
}

async function loadRaw(hash) {
  return new Promise((resolve, reject) => {
    let trans = db.transaction(['objects'], 'readwrite');
    let store = trans.objectStore('objects');
    let request = store.get(hash);

    request.onsuccess = (evt) => resolve(evt.target.result);
    request.onerror = (evt) => reject(evt.target.error);
  });
}

async function hasHash(hash) {
  let body = await loadRaw(hash);
  return !!body;
}

function readRef(ref) {
  return new Promise((resolve, reject) => {
    let key = this.refPrefix + '/' + ref;
    let trans = db.transaction(['refs'], 'readwrite');
    let store = trans.objectStore('refs');
    let request = store.get(key);

    request.onsuccess = (evt) => {
      let entry = evt.target.result;
      resolve(entry && entry.hash);
    };
    request.onerror = (evt) => reject(evt.target.error);
  });
}

function updateRef(ref, hash) {
  return new Promise((resolve, reject) => {
    let key = this.refPrefix + '/' + ref;
    let trans = db.transaction(['refs'], 'readwrite');
    let store = trans.objectStore('refs');
    let entry = { path: key, hash: hash };
    let request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = (evt) => reject(evt.target.error);
  });
}
