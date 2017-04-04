import sha1 from 'js-sha1';
import modes from '../lib/modes.js';
import JSZip from 'jszip';
import { IRepo } from './repo';
import { deflate, inflate } from 'pako';

type Constructor<T> = new(...args: any[]) => T;

export function CreateZipMixin<T extends Constructor<IRepo>>(Base: T) {
  return class extends Base {
    zip: JSZip;

    async createZip(...branchNames) {
      if (branchNames.indexOf('master') == -1) {
        if (await this.readRef('master')) {
          branchNames.unshift('master');
        }
      }

      let zip = new JSZip();

      let commits = await Promise.all(branchNames.map(async(name) => {
        let hash = await this.readRef(name);
        let commit = hash && await this.loadAs('commit', hash);
        if (!commit) throw new Error('no branch with that name');
        return Object.assign({ hash }, commit);
      }));

      let opts = { binary: true };

      if(branchNames.length) {
        // stage first in branchNames
        let headBranchName = branchNames[0];
        let commitHash = await this.readRef(headBranchName);
        let commit = await this.loadAs('commit', commitHash);
        let stagedFiles = await this.flattenTree(commit.tree);

        for (let { value, path } of stagedFiles) {
          zip.file(path.join('/'), value);
        }

        zip.file('.git/HEAD', `ref: refs/heads/${ headBranchName }\n`, opts);
        zip.file('.git/index', createIndex(stagedFiles), opts);

        for (let i=0; i < branchNames.length; i++) {
          let name = branchNames[i];
          let chash = commits[i].hash;
          zip.file(`.git/refs/heads/${ name }`, chash + '\n', opts);
        }
      }

      // save all objects by default TODO: use packing
      let objects = await this.enumerateObjects();
      for (let { hash, content } of objects) {
        if (typeof content === 'string' || content instanceof Uint8Array) {
          zip.file(['.git', 'objects', hash.substring(0, 2), hash.substring(2)].join('/'), deflate(content), opts);
          continue;
        }
        throw new Error('content must be a string');
      };

      return this.zip = zip;
    }

    async flattenTree(rootHash, prefix = []) {
      let tree = await this.loadAs('tree', rootHash);
      let result = [];
      for (let name in tree) {
        let { mode, hash } = tree[name];
        if (mode === modes.tree) {
          result.push(...await this.flattenTree(hash, prefix.concat(name)));
        } else if (mode === modes.blob) {
          let value = await this.loadAs('text', hash);
          result.push({ path: prefix.concat(name), value });
        }
      }
      return result;
    }



    async loadZip(data, headOnly = false) {
      let zip = this.zip;
      await zip.loadAsync(data, { createFolders: true });
      let git = zip.folder('.git');
      let currentBranch = await git.file('HEAD').async('string');
      let refs = git.folder('refs');

      let tags =    refs.folder('tags');
      let remotes = refs.folder('remotes');
      let heads =   refs.folder('heads');

      if (!currentBranch.startsWith('ref: ')) throw new Error('invalid HEAD');
      let path = currentBranch.substring(5).trim(); // like 'refs/heads/master'
      let branchNames = git.folder('refs').folder('heads')
        .filter((_, { dir }) => !dir).map(({ name }) => name.split('/').slice(-1)[0]);
      let headBranchName = (path.split('/').slice(-1)[0]).trim();
      let commit = (await git.file(path).async('string')).trim();
      // find those not yet saved
      let hashes = git.folder('objects')
        .filter((_, { dir }) => !dir)
        .map(({ name }) => name.split('/').slice(-2).join(''));
      let compressed = await Promise.all(hashes.map(hash => git
        .folder('objects')
        .file(hash.substring(0, 2) + '/' + hash.substring(2))
        .async('arraybuffer')));
      // save raw objects
      await Promise.all(hashes.map((hash, i) => this.saveRaw(hash, inflate(compressed[i]))));
      // branches
      await Promise.all(branchNames.map(name => git.file('refs/heads/' + name).async('string').then(commit => this.updateRef(name, commit.trim()))));
      return;
    }

    async addBranch(...branchNames) {
    }

    clear() {
      this.zip = null;
    }
  }
}

export async function log(repo, obj) {
  for (let name in obj) {
    let { mode, hash } = obj[name];
    if (mode && hash) {
      obj[name] = await repo.loadAs(modes.toType(mode), hash);
      if (mode == modes.tree) {
        await log(repo, obj[name]);
      } else if (mode == modes.blob) {
        obj[name] = obj[name].toString();
      }
    }
  }
  return obj;
}

function createIndex(files) {
  // from https://github.com/git/git/blob/master/Documentation/technical/index-format.txt
  files.sort(byPath);

  let names = files.map(({ path, value }) => {
    let name = path.join('/');
    let i = name.length + 8 - (name.length % 8);
    return { value, name, i };
  });

  let length = names.reduce((a, { i }) => a + i, names.length*64+12+20);
  let ret = new Uint8Array(length);

  ret.set('DIRC'.split('').map(c => c.charCodeAt(0)));
  ret.set([3], 7); ret.set(b32tob8(files.length), 8);

  let index = 12;
  for (let { name, value, i } of names) {
    index += 24; // 24
    // 1000 regular file, 0644 not execuatable
    let mode = (parseInt('1000', 2) << 12) | parseInt('0644', 8);
    ret.set(b32tob8(mode), index);
    index += 12; // 36
    let size = byteSize(value);
    ret.set(b32tob8(size), index);
    index += 4; // 40
    // everything in index is a file
    let sha = sha1arr(`blob ${value.length}\0${value}`);
    ret.set(sha, index);
    index += 20; // 60
    // assume valid, name length
    let flags = (0x4000 | Math.min(name.length, 0xFFF)) << 16;
    ret.set(b32tob8(flags), index);
    index += 4; // 64
    // (padded) pathname
    let pathbytes = name.split('').map(c => c.charCodeAt(0))
    ret.set(pathbytes, index);
    index += i;
  }

  ret.set(sha1arr(ret.subarray(0, length-20)), index);
  return ret;
}

function sha1arr(val) {
  let sha = sha1(val);
  let ret = [];
  for (let i=0; i < sha.length; i+=2) {
    ret.push(parseInt(sha.substring(i, i+2), 16));
  }
  return ret;
}

function byteSize(str) {
  return Math.min(encodeURI(str).split(/%(?:u[0-9A-F]{2})?[0-9A-F]{2}|./).length - 1, Math.pow(2, 32)/8);
}

function byPath(a, b) {
  return a.path > b.path ? 1 : b.path > a.path ? -1 : 0;
} 

function b32tob8(v) {
  return [v >> 24 & 0xFF, v >> 16 & 0xFF, v >> 8 & 0xFF, v & 0xFF];
}
