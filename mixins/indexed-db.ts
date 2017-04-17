import { frame } from '../lib/object-codec';
import sha1 from 'js-sha1';
import modes from '../lib/modes';
import { IRepo } from './repo';

interface ObjectRecord {
  type: string;
  hash: string;
  body: any;
}

interface RefRecord {
  path: string;
  hash: string;
}

type Constructor<T> = new(...args: any[]) => T;

export function indexedDBMixin<T extends Constructor<{}>>(Base: T) {
  return class extends Base {
    db: IDBDatabase;
    refPrefix: string;
  
    async init(name: string, version?:number) {
      return this.db = await openIndexedDB(name, version);
    }
  
    async saveAs(type: string, body: any): Promise<string> { let buffer = frame({ type, body })
      let hash = sha1(buffer);
      await addToStore(this.db, 'objects', { hash, type, body });
      return hash;
    }
  
    async saveManyAs(arr): Promise<string[]> {
      let hashed = arr.map(({ type, body }) => ({ hash: sha1(frame({ body, type })), body, type }));
      await addToStore(this.db, 'objects', hashed);
      return hashed.map(({ hash }) => hash);
    }
  
    async loadAs(type: string, hash: string): Promise<any> {
      let entry = <ObjectRecord>(await getFromStore(this.db, 'objects', hash));
      if (!entry) return null;
      if (type !== entry.type) {
        throw new TypeError('Type mismatch');
      }
      return entry.body;
    }
  
    async loadRaw(hash: string): Promise<ObjectRecord> {
      let entry = <ObjectRecord>(await getFromStore(this.db, 'objects', hash));
      return entry;
    }
  
    async loadManyRaw(hashes: string[]): Promise<ObjectRecord[]> {
      return await getManyFromStore(this.db, 'objects', hashes);
    }
  
    async hasHash(hash: string): Promise<boolean> {
      let body = await this.loadRaw(hash);
      return !!body;
    }
  
    async readRef(ref: string): Promise<string> {
      let path = this.refPrefix + '/' + ref;
      let entry = <RefRecord>(await getFromStore(this.db, 'refs', path));
      return entry && entry.hash;
    }
  
    async updateRef(ref: string, hash: string): Promise<void> {
      let path = this.refPrefix + '/' + ref;
      await addToStore(this.db, 'refs', { path, hash });
      return;
    }
  
    async enumerateObjects(): Promise<any[]> {
      let objects = await getAll(this.db, 'objects');
      return objects.map(({ body, hash, type }) => ({ hash, content: frame({type, body}) }));
    }
  }
}

function openIndexedDB(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request = indexedDB.open(name, version);

    request.onupgradeneeded = (evt: any) => {
      let db = evt.target.result;
  
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
  
      let objectsObjectStore = db.createObjectStore('objects', { keyPath: 'hash' });
      let keysObjectStore = db.createObjectStore('refs',       { keyPath: 'path' });
    };
  
    request.onsuccess = (evt: any) => resolve(evt.target.result);
    request.onerror = (evt: any) => reject(evt.target.error);
  });
}

function addToStore(db: IDBDatabase, storeName: string, obj: any): Promise<number> {
  return new Promise((resolve, reject) => {
    let store = db.transaction([storeName], 'readwrite')
      .objectStore(storeName)

    if (Array.isArray(obj)) {
      let fn = (i) => {
        if (i < obj.length) {
          let request = store.put(obj[i]);
          request.onsuccess = (evt) => fn(i+1);
          request.onerror = (evt: any) => reject(evt.target.error);
        } else {
          resolve(i);
        }
      }
      fn(0);
    } else {
      let request = store.put(obj);
      request.onsuccess = (evt: any) => resolve(evt.target.result);
      request.onerror = (evt: any) => reject(evt.target.error);
    }
  });
}

function getManyFromStore(db: IDBDatabase, storeName: string, keys: any): Promise<any[]> {
  return new Promise((resolve, reject) => {
    // algorithm by dfahlander
    let set = keys.slice().sort(comparer);
    let request = db.transaction([storeName], 'readonly')
      .objectStore(storeName)
      .openCursor();
    let i = 0;
    let results = [];

    request.onsuccess = (evt: any) => {
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
    request.onerror = (evt: any) => reject(evt.target.error);
  });
}

function getFromStore(db: IDBDatabase, storeName: string, key: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let trans = db.transaction([storeName], 'readonly');
    let store = trans.objectStore(storeName);
    let request = store.get(key);

    request.onsuccess = (evt: any) => resolve(evt.target.result);
    request.onerror = (evt: any) => reject(evt.target.error);
  });
}

function getAll(db: IDBDatabase, storeName: string, query?: IDBKeyRange, maxCount?: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    let store = db.transaction(['objects']).objectStore('objects');
    let request = (<any>store).getAll(query, maxCount);
    request.onsuccess = (evt) => resolve(evt.target.result);
    request.onerror = (evt) => reject(evt.target.error);
  });
}

function comparer(a, b): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
