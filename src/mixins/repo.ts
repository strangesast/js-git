type callback = (err, ...args) => any;
//import { Observable } from 'rxjs';

export type ObjectRecord = {
  type?: string,
  body: any,
  hash: string
}; 

export interface Repo {
  saveAs(type: string, body: any, cb?: callback, forcedHash?: string): Promise<string>;
  saveRaw?(hash: string, buffer: any):                                 Promise<void>;
  loadAs(type: string, hash: string, cb?:callback):                    Promise<any>;
  loadRaw(hash: string, cb?: callback):                                Promise<any>;
  hasHash?(hash: string, cb?: callback):                               Promise<boolean>;
  readRef(ref: string, cb?: callback):                                 Promise<string>;
  updateRef(ref: string, hash: string, cb?: callback):                 Promise<void>;
  listRefs(prefix?:string, cb?: callback):                             Promise<string[]>;
}
