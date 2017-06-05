export { Formats } from './formats';
export { CreateZip } from './create-zip';
export { CreateTree } from './create-tree';
export { IndexedDB } from './indexed-db';
export { MemDB } from './mem-db';
export { Repo } from './repo';
export function applyMixins(derivedCtor: any, baseCtors: any[]) {
  baseCtors.forEach(baseCtor => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
      derivedCtor.prototype[name] = baseCtor.prototype[name];
    });
  });
}
