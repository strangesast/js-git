import { Repo, ObjectRecord } from './repo';
import { frame } from '../lib/object-codec';
import * as sha1 from 'js-sha1';

export class IndexedDB implements Repo {
  public db: IDBDatabase;

  constructor(public refPrefix: string) {}

  async init(name: string, version?: number, callback?): Promise<void> {
    this.db = <IDBDatabase>(await new Promise((resolve, reject) => {
      let request = indexedDB.open(name, version);

      request.onupgradeneeded = (evt: any) => {
        let db = <IDBDatabase>request.result;
    
        request.transaction.onerror = (evt) => {
          reject(request.transaction.error);
        };
    
        let storeNames = [].slice.call(db.objectStoreNames);
        if (storeNames.indexOf('objects') > -1) {
          db.deleteObjectStore('objects');
        }
        if (storeNames.indexOf('refs') > -1) {
          db.deleteObjectStore('refs');
        }
    
        let objectsObjectStore = db.createObjectStore('objects', { keyPath: 'hash' });
        let keysObjectStore = db.createObjectStore('refs',       { keyPath: 'path' });

        request.transaction.oncomplete = (evt) => {
          resolve(db);
        };
      };
    
      request.onsuccess = (evt: any) => resolve(request.result);
      request.onerror = (evt: any) => reject(evt.target.error);
    }));
    if (callback) callback(this.db);
  }

  async reset(callback?): Promise<void> {
    if (!this.db) {
      throw new Error('not initialized');
    }
    let transaction = this.db.transaction(['objects', 'refs'], 'readwrite');
    let complete = new Promise((r) => transaction.oncomplete = () => r());
    transaction.objectStore('objects').clear();
    transaction.objectStore('refs').clear();
    await complete;
    if (callback) callback();
    return;
  }

  async saveAs(type: string, body: any, callback?, forcedHash?): Promise<string> {
    let transaction = this.db.transaction(['objects'], 'readwrite');
    let encodedBody = encodeBody(type, body);
    let buffer = frame({ type, body: encodedBody });
    let hash = forcedHash || sha1(buffer);
    let request = transaction.objectStore('objects').put({ hash, type, body, buffer });
    await new Promise((r) => request.onsuccess = () => r(request.result));
    if (callback) callback(hash);
    return hash;
  }

  async saveMany(objects: { type: string, body: any }[], callback?): Promise<string[]> {
    let transaction = this.db.transaction(['objects'], 'readwrite');
    let store = transaction.objectStore('objects');
    let items = objects.map(({ type, body }) => {
      let encodedBody = encodeBody(type, body);
      let buffer = frame({ type, body: encodedBody });
      let hash = sha1(buffer);
      return { type, hash, body, buffer };
    });
    let result = <string[]>(await new Promise((resolve, reject) => {
      let i = 0;
      next();
      function next() {
        if (i < items.length) {
          store.put(items[i++]).onsuccess = next;
        } else {
          resolve(items.map(({ hash }) => hash));
        }
      }
    }));
    return result;
  }

  async loadAs(type: string, hash: string, callback?): Promise<any> {
    let transaction = this.db.transaction(['objects']);
    let request = transaction.objectStore('objects').get(hash);
    let result = <ObjectRecord>(await new Promise((r) => request.onsuccess = () => r(<ObjectRecord>request.result)));
    if (result.type === type) {
      if (callback) callback(result.body);
      return result.body;
    }
    throw new TypeError('invalid type requested');
  }

  async loadRaw(hash: string, callback?): Promise<any> {
    let transaction = this.db.transaction(['objects']);
    let request = transaction.objectStore('objects').get(hash);
    let result = await new Promise((r) => request.onsuccess = () => r(request.result));
    if (callback) callback(result);
    return result;
  }

  async loadMany(hashes: string[], callback?): Promise<any> {
    let transaction = this.db.transaction(['objects']);
    hashes.sort(comparer);
    let result = await new Promise((resolve, reject) => {
      let i = 0;
      let request = transaction.objectStore('objects').openCursor();
      let result = [];
      request.onsuccess = (e) => {
        let cursor = request.result;
        if (!cursor) return resolve(result);
        let key = cursor.key;
        while (key > hashes[i]) {
          ++i
          if (i === hashes.length) {
            return resolve(result);
          }
        }
        if (key === hashes[i]) {
          result.push(cursor.value);
          cursor.continue();
        } else {
          cursor.continue(hashes[i]);
        }
      };
      request.onerror = (e) => reject(e);
    });
    if (callback) callback(result);
    return result;
  }

  async readRef(ref: string, callback?): Promise<string> {
    let path = this.refPrefix + '/' + ref;
    let transaction = this.db.transaction(['refs']);
    let request = transaction.objectStore('refs').get(path);
    let result = <string>(await new Promise((r) => request.onsuccess = () => r(request.result)));
    if (callback) callback(result);
    return result;
  }

  async updateRef(ref: string, hash: string, callback?): Promise<void> {
    let path = this.refPrefix + '/' + ref;
    let transaction = this.db.transaction(['refs'], 'readwrite');
    let request = transaction.objectStore('refs').put({ path, hash });
    let result = <string>(await new Promise((r) => request.onsuccess = () => r(request.result)));
    if (callback) callback();
    return;
  }

  async listRefs(prefix=this.refPrefix, callback?): Promise<string[]> {
    let transaction = this.db.transaction(['refs']);
    let request = transaction.objectStore('refs').getAll();
    let result = <string[]>(await new Promise((r) => request.onsuccess = () => r(request.result)));
    if (callback) callback();
    return result;
  }
}

function encodeBody(type, body) {
  let encodedBody = body;
  if (type === 'blob') {
    if (typeof encodedBody !== 'string') {
      encodedBody = JSON.stringify(encodedBody);
    }
    if (!(encodedBody instanceof Uint8Array)) {
      encodedBody = new TextEncoder().encode(encodedBody);
    }
  }
  return encodedBody;
}

function comparer (a, b) {
  return a < b? -1 : a > b ? 1 : 0;
}
