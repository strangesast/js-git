declare const TextEncoder: new (type?:string) => { encode: (body: string) => Uint8Array };
declare const TextDecoder: new (type?:string) => { decode: (body: Uint8Array) => string };

declare interface IDBObjectStore {
  getAll(query?, count?:number): IDBRequest
}
