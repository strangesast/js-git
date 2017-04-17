import { frame, deframe } from '../lib/object-codec.js';
import sha1 from 'git-sha1';

type Constructor<T> = new(...args: any[]) => T;
type validType = 'blob'|'tree'|'commit'|'tag';

export function memDBMixin<T extends Constructor<{}>>(Base: T) {
  return class extends Base {
    objects = {};
    refs = {};
    refPrefix: string;
  
    async saveAs(type: validType, body): Promise<string> {
      let buffer = frame({ type, body });
      let hash = sha1(buffer);
      this.objects[hash] = buffer;
      return hash;
    }
  
    async saveManyAs(arr: [{ type: validType, body }]): Promise<number> {
      return (await Promise.all(arr.map(({ type, body }) => this.saveAs(type, body)))).length;
    }
  
    async saveRaw(hash: string, buffer): Promise<string> {
      return (this.objects[hash] = buffer) && hash;
    }
  
    async saveManyRaw(arr: [{ hash: string, buffer }]) {
      return (await Promise.all(arr.map(({ hash, buffer }) => this.saveRaw(hash, buffer)))).length;
    }
  
    async loadAs(type: validType, hash: string) {
      let buffer = this.objects[hash];
      if (!buffer) return [];
      let obj = deframe(buffer, true);
      if (obj.type !== type) throw new TypeError("Type mismatch");
      return obj.body;
    }
  
    async loadRaw(hash: string) {
      return this.objects[hash];
    }
  
    async hasHash(hash: string): Promise<boolean> {
      return this.objects.hasOwnProperty(hash);
    }
  
    async readRef(ref: string): Promise<string> {
      return this.refs[this.refPrefix + '/' + ref];
    }
  
    async updateRef(ref: string, hash: string): Promise<string> {
      return this.refs[this.refPrefix + '/' + ref] = hash;
    }
  
    async listRefs(prefix: string) {
      let out = {};
      for (let name of Object.keys(this.refs)) {
        if (name.startsWith(prefix + '/')) {
          out[name] = this.refs[name];
        }
      }
      return out;
    }
  
    async enumerateObjects() {
      let hashes = Object.keys(this.objects);
      return hashes.map(hash => ({ hash, content: this.objects[hash] }));
    }
  }
}
