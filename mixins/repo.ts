export interface IRepo {
  saveAs(type: string, body: any):      Promise<string>;
  saveRaw(hash: string, body: any):     Promise<string>;
  loadAs(type: string, hash: string):   Promise<any>;
  loadRaw(hash: string):                Promise<any>;
  readRef(ref: string):                 Promise<string>;
  updateRef(ref: string, hash: string): Promise<void>;
  enumerateObjects():                   Promise<any[]>;
}

export class Repo {
  constructor(public refPrefix: string) {}
}

export default Repo;
