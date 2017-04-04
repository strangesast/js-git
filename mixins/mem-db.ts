import { frame, deframe } from '../lib/object-codec.js';
import { IRepo } from '../mixins/repo';
import sha1 from 'git-sha1';

type Constructor<T> = new(...args: any[]) => T;

export function MemDBMixin<T extends Constructor<IRepo>>(Base: T) {
  return class extends Base {
    objects = {};
    refs = {};
    refPrefix: string;
  
    async saveAs(type: string, body: any): Promise<string> {
      let buffer = frame({ type, body });
      let hash = sha1(buffer);
      this.objects[hash] = buffer;
      return hash;
    }
  
    async saveManyAs(arr) {
      return (await Promise.all(arr.map(({ type, body }) => this.saveAs(type, body)))).length;
    }
  
    async saveRaw(hash, buffer) {
      return (this.objects[hash] = buffer) && hash;
    }
  
    async saveManyRaw(arr) {
      return (await Promise.all(arr.map(({ hash, buffer }) => this.saveAs(hash, buffer)))).length;
    }
  
    async loadAs(type, hash) {
      let buffer = this.objects[hash];
      if (!buffer) return [];
      let obj = deframe(buffer, true);
      if (obj.type !== type) throw new TypeError("Type mismatch");
      return obj.body;
    }
  
    async loadRaw(hash) {
      return this.objects[hash];
    }
  
    async hasHash(hash) {
      return hash in this.objects;
    }
  
    async readRef(ref) {
      return this.refs[this.refPrefix + '/' + ref];
    }
  
    async updateRef(ref, hash) {
      return this.refs[this.refPrefix + '/' + ref] = hash;
    }
  
    async listRefs(prefix) {
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
