import { fromUnicode } from 'bodec';
import modes from '../lib/modes';
import { Formats, IndexedDB, applyMixins, Repo } from '../mixins';

const blob = fromUnicode("Hello World\n");
const blobHash = "557db03de997c86a4a028e1ebd3a1ceb225be238";
const treeHash = 'c0527a06bdca1031041a1b0a5195bdec38c4e68d';
const dbName = 'testt';
const fname = 'test.txt';

class IDBRepo implements Formats, IndexedDB, Repo {
  zip;
  createZip: (...branchNames) => Promise<any>;
  loadZip: (data, headOnly) => Promise<any>;
  addBranch: (...branchNames) => Promise<void>;
  clear: () => void;
  db;
  refPrefix: string;
  init: (name, version) => Promise<any>;
  flattenTree: (rootHash, prefix) => Promise<any>;
  createTree: (entries) => Promise<any>;
  loadAs: (type, hash) => Promise<any>;
  saveAs: (type, body) => Promise<string>;
  saveManyAs: (arr) => Promise<string[]>;
  saveRaw: (hash, buffer) => Promise<string>;
  saveManyRaw: (arr) => Promise<number>;
  loadRaw: (hash) => Promise<any>;
  loadManyRaw: (hashes) => Promise<any>;
  hasHash: (hash) => Promise<boolean>;
  listRefs: (prefix) => Promise<any>;
  enumerateObjects: () => Promise<any[]>;
  readRef: (ref) => Promise<string>;
  updateRef: (ref, hash) => Promise<void>;
}
applyMixins(IDBRepo, [Formats, IndexedDB]);

describe('indexeddb mixin', () => {
  var commitHash;
  var repo = new IDBRepo();
  var db;

  describe('saveAs', () => {
    it('should save blob', test(async() => {
      db = await repo.init(dbName, 1);
      let hash = await repo.saveAs('blob', blob);
      expect(hash).toBe(blobHash); // 'blob saved incorrectly'
    }));

    it('should save tree', test(async() => {
      let hash = await repo.saveAs('tree', {
        [fname]: { hash: blobHash, mode: modes.tree }
      });
      expect(treeHash).toBe(hash); // 'tree was saved incorrectly'
    }));

    it('should save commit', test(async() => {
      commitHash = await repo.saveAs('commit', {
        author: {
          name: 'test',
          email: 'test@example.com'
        },
        tree: treeHash,
        message: 'test!'
      });
      expect(commitHash).toBeDefined(); // 'failed to save'
    }));
  });

  describe('loadAs', () => {
    it('should load each type of data', () => {
      it('should load a commit', test(async() => {
        let commit = await repo.loadAs('commit', commitHash);
        expect(commit).toBeTruthy(); // 'failed to load'
        expect(commit.tree).toBe(treeHash);
      }));

      it('should load a tree', test(async() => {
        let tree = await repo.loadAs('tree', treeHash);
        expect(tree[fname]).toBeTruthy();
      }));

      it('should load a blob', test(async() => {
        expect(blob).toEqual(await repo.loadAs('blob', blobHash));
      }));
    });

    /*
    it('should fail to load a mismatched type', test(async() => {
      var fn = async() => {
        await repo.loadAs('commit', treeHash);
      };
      expect(fn).toThrowError('Type mismatch');
    }));
    */
  });

  describe('loadRaw', () => {
    let hashes = [];

    it('should load byte array', test(async() => {
      for( let i=0; i < 5; i++) {
        let hash = await repo.saveAs('blob', `Test ${ i }\n`);
        hashes.push(hash);
      }

      let data = await repo.loadRaw(hashes[0]);
      expect('Test 0\n').toBe(data.body);
    }));
    it('should load multiple byte arrays', test(async() => {
      let data = await repo.loadManyRaw(hashes);
      expect(hashes.length).toEqual(data.length);
    }));
  });

  describe('update/readRef', () => {
    it('should add ref for hash', test(async() => {
      expect(async() => await repo.updateRef('testRef', commitHash)).not.toThrow();
    }));
    it('should return null for nonexistant ref', test(async() => {
      let ref = await repo.readRef('toastRef');
      expect(ref).toBeFalsy();
    }));
    it('should read correct hash', test(async() => {
      let ref = await repo.readRef('testRef');
      expect(ref).toBe(commitHash);
    }));
  });

  describe('hasHash', () => {
    it('should verify that hash was saved for blob', test(async() => {
      expect(async() => await repo.hasHash(blobHash)).not.toThrowError(); // 'Hash was not saved for blob'
    }));
  });
});
function test(run) {
  return (done) => {
    run().then(done, e => { done.fail(e); done(); });
  };
}
