import { fromUnicode } from 'bodec';
import modes from '../lib/modes';
import { formatsMixin, indexedDBMixin, IRepo } from '../mixins';

const blob = fromUnicode("Hello World\n");
const blobHash = "557db03de997c86a4a028e1ebd3a1ceb225be238";
const treeHash = 'c0527a06bdca1031041a1b0a5195bdec38c4e68d';
const dbName = 'testt';
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
class SpecialRepo extends formatsMixin(indexedDBMixin(Repo)) {}

describe('indexeddb mixin', () => {
  var commitHash;
  var repo = new SpecialRepo('toast');
  var db;

  describe('saveAs', () => {
    it('should save blob', async(done) => {
      db = await repo.init(dbName, 1);
      let hash = await repo.saveAs('blob', blob);
      expect(hash).toBe(blobHash); // 'blob saved incorrectly'
      done();
    });

    it('should save tree', async(done) => {
      let hash = await repo.saveAs('tree', {
        [fname]: { hash: blobHash, mode: modes.tree }
      });
      expect(treeHash).toBe(hash); // 'tree was saved incorrectly'
      done();
    });

    it('should save commit', async(done) => {
      commitHash = await repo.saveAs('commit', {
        author: {
          name: 'test',
          email: 'test@example.com'
        },
        tree: treeHash,
        message: 'test!'
      });
      expect(commitHash).toBeDefined(); // 'failed to save'
      done();
    });
  });

  describe('loadAs', () => {
    it('should load each type of data', () => {
      it('should load a commit', async(done) => {
        let commit = await repo.loadAs('commit', commitHash);
        expect(commit).toBeTruthy(); // 'failed to load'
        expect(commit.tree).toBe(treeHash);
        done();
      });

      it('should load a tree', async(done) => {
        let tree = await repo.loadAs('tree', treeHash);
        expect(tree[fname]).toBeTruthy();
        done();
      });

      it('should load a blob', async(done) => {
        expect(blob).toEqual(await repo.loadAs('blob', blobHash));
        done();
      });
    });

    /*
    it('should fail to load a mismatched type', async(done) => {
      var fn = async() => {
        await repo.loadAs('commit', treeHash);
      };
      expect(fn).toThrowError('Type mismatch');
      done();
    });
    */
  });

  describe('loadRaw', () => {
    let hashes = [];

    it('should load byte array', async(done) => {
      for( let i=0; i < 5; i++) {
        let hash = await repo.saveAs('blob', `Test ${ i }\n`);
        hashes.push(hash);
      }

      let data = await repo.loadRaw(hashes[0]);
      expect('Test 0\n').toBe(String.fromCharCode(...data.body));
      done();
    });
    it('should load multiple byte arrays', async(done) => {
      let data = await repo.loadManyRaw(hashes);
      expect(hashes.length).toEqual(data.length);
      done();
    });
  });

  describe('update/readRef', () => {
    it('should add ref for hash', async(done) => {
      expect(async() => await repo.updateRef('testRef', commitHash)).not.toThrow();
      done();
    });
    it('should return null for nonexistant ref', async(done) => {
      let ref = await repo.readRef('toastRef');
      expect(ref).toBeFalsy();
      done();
    });
    it('should read correct hash', async(done) => {
      let ref = await repo.readRef('testRef');
      expect(ref).toBe(commitHash);
      done();
    });
  });

  describe('hasHash', () => {
    it('should verify that hash was saved for blob', async(done) => {
      expect(async() => await repo.hasHash(blobHash)).not.toThrowError(); // 'Hash was not saved for blob'
      done();
    });
  });
});
