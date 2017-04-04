import { fromUnicode, toUnicode } from 'bodec';
import sha1 from 'git-sha1';
import { frame, deframe } from '../lib/object-codec';
import { FormatsMixin, MemDBMixin, IRepo } from '../mixins';

var blob = fromUnicode("Hello World\n");
var blobHash = "557db03de997c86a4a028e1ebd3a1ceb225be238";

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
class SpecialRepo extends FormatsMixin(MemDBMixin(Repo)) {}

describe('memdb mixin', () => {
  var db;
  var repo = new SpecialRepo('test')

  describe('saveAs', () => {
    it('should save blob', async(done) => {
      let hash = await repo.saveAs('blob', blob);
      expect(hash).toEqual(blobHash); // 'Hash mismatch'
      done();
    });
  });

  describe('loadRaw', () => {
    it('should encode blob properly', async(done) => {
      let bin = await repo.loadRaw(blobHash)
      let obj = deframe(bin, true);
      expect(obj.type).toBe('blob'); // 'Wrong type'
      expect(toUnicode(obj.body)).toEqual(toUnicode(blob)); // 'Wrong body'
      done();
    });
  });

  describe('loadAs', () => {
    it('should load blob with hash', async(done) => {
      let body = await repo.loadAs("blob", blobHash);
      expect(toUnicode(body)).toEqual(toUnicode(blob)); // 'Wrong body'
      done();
    });
  });

  describe('saveRaw', () => {
    it('should save binary body', async(done) => {
      let newBody = fromUnicode("A new body\n");
      let bin = frame({ type:"blob", body: newBody });
      let hash = sha1(bin);
      await repo.saveRaw(hash, bin);

      let body = await repo.loadAs("blob", hash);
      expect(toUnicode(body)).toEqual(toUnicode(newBody)); // 'Body mismatch')
      done();
    });
  });
});
