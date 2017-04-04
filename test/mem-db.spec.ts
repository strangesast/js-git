import {} from 'jasmine';
import { fromUnicode, toUnicode } from 'bodec';
import sha1 from 'git-sha1';
import { frame, deframe } from '../lib/object-codec';
import { FormatsMixin, MemDBMixin, Repo } from '../mixins';

var blob = fromUnicode("Hello World\n");
var blobHash = "557db03de997c86a4a028e1ebd3a1ceb225be238";

class SpecialRepo extends FormatsMixin(MemDBMixin(Repo)) {
}

describe('memdb mixin', () => {
  var db;
  var repo = new SpecialRepo('test')

  describe('saveAs', () => {
    it('should save blob', async() => {
      let hash = await repo.saveAs('blob', blob);
      expect(hash).toEqual(blobHash); // 'Hash mismatch'
    });
  });

  describe('loadRaw', () => {
    it('should encode blob properly', async() => {
      let bin = await repo.loadRaw(blobHash)
      let obj = deframe(bin, true);
      expect(obj.type).toBe('blob'); // 'Wrong type'
      expect(toUnicode(obj.body)).toEqual(toUnicode(blob)); // 'Wrong body'
    });
  });

  describe('loadAs', () => {
    it('should load blob with hash', async() => {
      let body = await repo.loadAs("blob", blobHash);
      expect(toUnicode(body)).toEqual(toUnicode(blob)); // 'Wrong body'
    });
  });

  describe('saveRaw', () => {
    it('should save binary body', async() => {
      let newBody = fromUnicode("A new body\n");
      let bin = frame({ type:"blob", body: newBody });
      let hash = sha1(bin);
      await repo.saveRaw(hash, bin);

      let body = await repo.loadAs("blob", hash);
      expect(toUnicode(body)).toEqual(toUnicode(newBody)); // 'Body mismatch')
    });
  });
});
