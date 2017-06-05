export abstract class Repo {
  abstract saveAs(type: string, body: any):      Promise<string>;
  abstract saveRaw(hash: string, body: any):     Promise<string>;
  abstract loadAs(type: string, hash: string):   Promise<any>;
  abstract loadRaw(hash: string):                Promise<any>;
  abstract readRef(ref: string):                 Promise<string>;
  abstract updateRef(ref: string, hash: string): Promise<void>;
}
export default Repo;
