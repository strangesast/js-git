import {} from 'jasmine';
//import assert from 'assert';
import { fromUnicode } from 'bodec';
import modes from '../lib/modes';
import { FormatsMixin, IndexedDBMixin, IRepo } from '../mixins';

const blob = fromUnicode("Hello World\n");
const blobHash = "557db03de997c86a4a028e1ebd3a1ceb225be238";
const treeHash = 'c0527a06bdca1031041a1b0a5195bdec38c4e68d';
const dbName = 'test';
const fname = 'test.txt';

class Repo implements IRepo {
  saveAs;
  loadAs;
  saveRaw;
  loadRaw;
  readRef;
  updateRef;
  enumerateObjects;
  constructor(public refPrefix: string) {}
}
class SpecialRepo extends FormatsMixin(IndexedDBMixin(Repo)) {}

describe('indexeddb mixin', async() => {
  var commitHash;
  var repo = new SpecialRepo('toast');
  var db = await repo.init(dbName, 1);

  describe('saveAs', () => {
    it('should save blob', async() => {
      let hash = await repo.saveAs('blob', blob);
      expect(hash).toBe(blobHash); // 'blob saved incorrectly'
    });

    it('should save tree', async() => {
      let hash = await repo.saveAs('tree', {
        [fname]: { hash: blobHash, mode: modes.tree }
      });
      expect(treeHash).toBe(hash); // 'tree was saved incorrectly'
    });

    it('should save commit', async() => {
      commitHash = await repo.saveAs('commit', {
        author: {
          name: 'test',
          email: 'test@example.com'
        },
        tree: treeHash,
        message: 'test!'
      });
      expect(commitHash).toBeDefined(); // 'failed to save'
    });
  });

  describe('loadAs', () => {
    it('should load each type of data', () => {
      it('should load a commit', async() => {
        let commit = await repo.loadAs('commit', commitHash);
        expect(commit).toBeTruthy(); // 'failed to load'
        expect(commit.tree).toBe(treeHash);
      });

      it('should load a tree', async() => {
        let tree = await repo.loadAs('tree', treeHash);
        expect(tree[fname]).toBeTruthy();
      });

      it('should load a blob', async() => {
        expect(blob).toEqual(await repo.loadAs('blob', blobHash));
      });
    });

    it('should fail to load a mismatched type', async() => {
      expect(await repo.loadAs('commit', treeHash)).toThrowError('Type mismatch');
    });
  });

  describe('loadRaw', async() => {
    let hashes = [];

    for( let i=0; i < 5; i++) {
      hashes.push(await repo.saveAs('blob', `Test ${ i }\n`));
    }

    it('should load byte array', async() => {
      let data = await repo.loadRaw(hashes[0]);
      expect('Test 0\n').toBe(String.fromCharCode(...data.body));
    });
    it('should load multiple byte arrays', async() => {
      let data = await repo.loadManyRaw(hashes);
      expect(hashes.length).toEqual(data.length);
    });
  });

  describe('update/readRef', () => {
    it('should add ref for hash', async() => {
      expect(await repo.updateRef('testRef', commitHash)).not.toThrow();
    });
    it('should return null for nonexistant ref', async() => {
      let ref = await repo.readRef('toastRef');
      expect(ref).toBeNull();
    });
    it('should read correct hash', async() => {
      let ref = await repo.readRef('testRef');
      expect(ref).toBe(commitHash);
    });
  });

  describe('hasHash', () => {
    it('should verify that hash was saved for blob', async() => {
      expect(await repo.hasHash(blobHash)).not.toThrowError(); // 'Hash was not saved for blob'
    });
  });
});
