import { applyMixins } from '../lib/util';
import { frame, validType, validHash, validateBody } from '../lib/object-codec';
import { Observable } from 'rxjs';
import * as sha1 from 'js-sha1';

type ObjectRecord = { type?: string, body: any, hash: validHash }; 

interface Repo {
  saveAs(type: validType, body: Uint8Array | string): Observable<validHash> | Promise<validHash> | validHash;
  saveRaw(hash: validHash, body: Uint8Array | string): Observable<validHash> | Promise<validHash> | validHash;
  loadAs(type: validType, hash: validHash): Observable<any> | Promise<any> | any;
  loadRaw(hash: validHash): Observable<any> | Promise<any> | any;
  readRef(ref: string): Observable<validHash> | Promise<validHash> | validHash;
  updateRef(ref: string, hash: validHash): Observable<void> | Promise<void> | void;
}

export class IndexedDB implements Repo {
  db: IDBDatabase;

  constructor(public refPrefix: string) {}

  async init(name: string, version?: number): Promise<void> {
    this.db = <IDBDatabase>(await new Promise((resolve, reject) => {
      let request = indexedDB.open(name, version);

      request.onupgradeneeded = (evt: any) => {
        let db = <IDBDatabase>request.result;
    
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
        resolve(db);
      };
    
      request.onsuccess = (evt: any) => resolve(request.result);
      request.onerror = (evt: any) => reject(evt.target.error);
    }));
  }

  async reset(): Promise<void> {
    if (!this.db) {
      throw new Error('not initialized');
    }
    let transaction = this.db.transaction(['objects', 'refs'], 'readwrite');
    let complete = new Promise((r) => transaction.oncomplete = () => r());
    transaction.objectStore('objects').clear();
    transaction.objectStore('refs').clear();
    await complete;
    return;
  }

  async saveAs(type: validType, body: Uint8Array | string): Promise<validHash> {
    validateBody(body);
    let transaction = this.db.transaction(['objects'], 'readwrite');
    let encodedBody = typeof body == 'string' ? new TextEncoder('utf-8').encode(body) : body;
    let buffer = frame({ type, body: encodedBody });
    let hash = sha1(buffer);
    let request = transaction.objectStore('objects').put({ hash, type, body });

    await new Promise((r) => request.onsuccess = () => r(request.result));
    return hash;
  }

  async saveRaw(hash: validHash, body: Uint8Array | string): Promise<validHash> {
    validateBody(body);
    let transaction = this.db.transaction(['objects'], 'readwrite');
    let request = transaction.objectStore('objects').put({ hash, body });
    await new Promise((r) => request.onsuccess = () => r(request.result));
    return hash;
  }

  async loadAs(type: validType, hash: validHash): Promise<any> {
    let transaction = this.db.transaction(['objects']);
    let request = transaction.objectStore('objects').get(hash);
    let result = <ObjectRecord>(await new Promise((r) => request.onsuccess = () => r(<ObjectRecord>request.result)));
    if (result.type === type) {
      return result;
    }
    throw new TypeError('invalid type requested');
  }

  async loadRaw(hash: validHash): Promise<any> {
    let transaction = this.db.transaction(['objects']);
    let request = transaction.objectStore('objects').get(hash);
    let result = await new Promise((r) => request.onsuccess = () => r(request.result));
    return result;
  }

  async readRef(ref: string): Promise<validHash> {
    let path = this.refPrefix + '/' + ref;
    let transaction = this.db.transaction(['refs']);
    let request = transaction.objectStore('refs').get(path);
    let result = <validHash>(await new Promise((r) => request.onsuccess = () => r(request.result)));
    return result;
  }

  async updateRef(ref: string, hash: validHash): Promise<void> {

  }

}
