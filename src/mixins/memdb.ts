import { applyMixins } from '../lib/util';
import { deframe, frame, validateBody } from '../lib/object-codec';
import { Repo, ObjectRecord } from './repo';
//import { Observable } from 'rxjs';
import * as sha1 from 'js-sha1';

export class MemDB implements Repo {
  private objects: { [key: string]: Uint8Array } = {};
  private refs: { [key: string]: string } = {};

  constructor(public refPrefix: string) {}

  async saveAs(type: string, body: any, callback?): Promise<string> {
    let buffer = frame({ type, body });
    let hash = sha1(buffer);
    this.objects[hash] = buffer;
		if (callback) callback(null, hash);
    return hash;
  }

  async saveRaw(hash: string, buffer: Uint8Array, callback?): Promise<void> {
    this.objects[hash] = buffer;
    if (callback) callback(null);
    return;
  }

  async loadAs(type: string, hash: string, callback?): Promise<any> {
    let buffer = this.objects[hash];
    if (!buffer) {
      return null;
    }
    let { type: t, body } = deframe(buffer);
    if (t !== type) {
      throw new TypeError('type mismatch');
    }
    if (callback) callback(null, body);
    return body;
  }

  async loadRaw(hash: string, callback?) {
    let buffer = this.objects[hash];
    if (callback) callback(null, buffer);
    return buffer;
  }

  async readRef(ref: string, callback?): Promise<string> {
    let hash = this.refs[this.refPrefix + '/' + ref];
    if (callback) callback(null, hash);
    return hash;
  }

  async updateRef(ref: string, hash: string, callback?): Promise<void> {
    this.refs[ref] = hash;
    if (callback) callback(null);
    return;
  }

  async listRefs(prefix=this.refPrefix, callback?): Promise<string[]> {
    let refs = Object.keys(this.refs);
    if (prefix) {
      refs = refs.filter(ref => ref.startsWith(prefix + '/'))
    }
    if (callback) callback(null, refs);
    return refs;
  }
}
