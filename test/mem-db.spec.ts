import { fromUnicode, toUnicode } from 'bodec';
import sha1 from 'git-sha1';
import { frame, deframe } from '../lib/object-codec';
import { applyMixins, Formats, MemDB, Repo } from '../mixins';

var blob = fromUnicode("Hello World\n");
var blobHash = "557db03de997c86a4a028e1ebd3a1ceb225be238";

class SpecialRepo implements Formats, MemDB, Repo {
  objects = {}
  refs = {};
  refPrefix
  createTree: (entries) => Promise<any>;
  loadAs: (type, hash) => Promise<any>;
  saveAs: (type, body) => Promise<string>;
  saveManyAs: (arr) => Promise<number>;
  saveRaw: (hash, buffer) => Promise<string>;
  saveManyRaw: (arr) => Promise<number>;
  loadRaw: (hash) => Promise<any>;
  hasHash: (hash) => Promise<boolean>;
  listRefs: (prefix) => Promise<any>;
  enumerateObjects: () => Promise<any[]>;
  readRef: (ref) => Promise<string>;
  updateRef: (ref, hash) => Promise<void>;
}
applyMixins(SpecialRepo, [Formats, MemDB]);

describe('memdb mixin', () => {
  var db;
  var repo = new SpecialRepo();

  describe('saveAs', () => {
    it('should save blob', test(async() => {
      let hash = await repo.saveAs('blob', blob);
      expect(hash).toEqual(blobHash); // 'Hash mismatch'
    }));
  });

  describe('loadRaw', () => {
    it('should encode blob properly', test(async() => {
      let bin = await repo.loadRaw(blobHash)
      let obj = deframe(bin, true);
      expect(obj.type).toBe('blob'); // 'Wrong type'
      expect(toUnicode(obj.body)).toEqual(toUnicode(blob)); // 'Wrong body'
    }));
  });

  describe('loadAs', () => {
    it('should load blob with hash', test(async() => {
      let body = await repo.loadAs("blob", blobHash);
      expect(toUnicode(body)).toEqual(toUnicode(blob)); // 'Wrong body'
    }));
  });

  describe('saveRaw', () => {
    it('should save binary body', test(async() => {
      let newBody = fromUnicode("A new body\n");
      let bin = frame({ type:"blob", body: newBody });
      let hash = sha1(bin);
      await repo.saveRaw(hash, bin);

      let body = await repo.loadAs("blob", hash);
      expect(toUnicode(body)).toEqual(toUnicode(newBody)); // 'Body mismatch')
    }));
  });
});
function test(run) {
  return (done) => {
    run().then(done, e => { done.fail(e); done(); });
  };
}
