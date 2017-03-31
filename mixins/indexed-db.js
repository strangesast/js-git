"use strict";
/*global indexedDB*/

var codec = require('../lib/object-codec.js');
var sha1 = require('git-sha1');
var modes = require('../lib/modes.js');
var db;

mixin.init = init;

mixin.loadAs = loadAs;
mixin.loadManyRaw = loadManyRaw;
mixin.saveAs = saveAs;
mixin.saveManyAs = saveManyAs;
mixin.loadRaw = loadRaw;
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

      let storeNames = [].slice.call(db.objectStoreNames);
      if (storeNames.indexOf('objects') != -1) {
        db.deleteObjectStore('objects');
      }
      if (storeNames.indexOf('refs') != -1) {
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
  repo.saveManyAs = saveManyAs;
  repo.loadAs = loadAs;
  repo.loadRaw = loadRaw;
  repo.loadManyRaw = loadManyRaw;
  repo.readRef = readRef;
  repo.updateRef = updateRef;
  repo.hasHash = hasHash;
  repo.enumerateObjects = enumerateObjects;
  repo.filterMissingHashes = filterMissingHashes;
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
    let request = store.put({ hash, type, body });

    request.onsuccess = () => resolve(hash);
    request.onerror = (evt) => reject(evt.target.error);
  });
}

function saveManyAs(arr) {
  return new Promise((resolve, reject) => {
    let store = db.transaction(['objects'], 'readwrite').objectStore('objects');
    let prep;
    try {
      prep = arr.map(({ type, body }) => {
        let hash = sha1(codec.frame({ type, body }));
        return { hash, body, type };
      });
    } catch (e) {
      return reject(e);
    }
    let fn = (i) => {
      if (i >= prep.length) {
        resolve(i-1);
      } else {
        let req = store.put(prep[i]);
        req.onsuccess = (evt) => fn(i+1);
        req.onerror = (evt) => reject(evt.target.error);
      }
    };
    fn(0);
  });
}

async function loadAs(type, hash) {
  let entry = await loadRaw(hash);
  if (!entry) return null;
  if (type !== entry.type) {
    throw new TypeError('Type mismatch');
  }
  return entry.body;
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

function comparer(a, b) {
  return a < b ? -1 : a > b ? -1 : 0;
}

async function loadManyRaw(hashes) {
  return new Promise((resolve, reject) => {
    // algorithm by dfahlander
    let set = hashes.slice().sort(comparer);
    let request = db.transaction(['objects'], 'readonly')
      .objectStore('objects')
      .openCursor();
    let i = 0;
    let results = [];

    request.onsuccess = (evt) => {
      let cursor = evt.target.result;
      if (!cursor) return resolve(results);

      let key = cursor.key;

      while (key > set[i]) {
        ++i;

        if (i === set.length) return resolve(results);
      }

      if (key === set[i]) {
        results.push(cursor.value);
        cursor.continue();

      } else {
        cursor.continue(set[i]);
      }
    };
    request.onerror = (evt) => reject(evt.target.error);
  });
}

function filterMissingHashes(arr) {
  return new Promise((resolve, reject) => {
    // copy arg, filter duplicates, match sort in db
    let ret = arr.slice().filter((h, i, a) => a.indexOf(h) == i).sort(comparer);
    let i = 0;
    let request = db.transaction(['objects'])
      .objectStore('objects')
      .openCursor();

    request.onsuccess = (evt) => {
      let cursor = evt.target.result;
      if (!cursor) return resolve(ret);
      let key = cursor.key;

      while (key > ret[i]) {
        if (++i === ret.length) {
          return resolve(ret);
        }
      }

      if (key === ret[i]) {
        ret.splice(i--, 1);
        if (ret.length == 0) {
          return resolve(ret);
        }
        cursor.continue();
      } else {
        cursor.continue(ret[i]);
      }
    };
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

function enumerateObjects() {
  return getAll().then(objects => objects && objects.map(({ hash, body, type }) => ({ hash, content: codec.frame({ type, body }) })));
}

/*
function enumerateObjects() {
  return getAll().then(objects => objects.map(obj => ({ hash: obj.hash, content: obj })));
}
*/

function getAll(query, count) {
  return new Promise((resolve, reject) => {
    let store = db.transaction(['objects']).objectStore('objects');
    let request = store.getAll(query, count);
    request.onsuccess = (evt) => resolve(evt.target.result);
    request.onerror = (evt) => reject(evt.target.error);
  });
}
