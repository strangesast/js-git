var assert = require('assert');
var bodec = require('bodec');
var sha1 = require('git-sha1');
var codec = require('../lib/object-codec.js');
var memdb = require('../mixins/mem-db.js');

var blob = bodec.fromUnicode("Hello World\n");
var blobHash = "557db03de997c86a4a028e1ebd3a1ceb225be238";

describe('memdb mixin', () => {
  var db;
  var repo = {};

  before(async() => {
    memdb(repo);
  });

  describe('saveAs', () => {
    it('should save blob', async() => {
      let hash = await repo.saveAs('blob', blob);
      assert.equal(hash, blobHash, 'Hash mismatch');
    });
  });

  describe('loadRaw', () => {
    it('should encode blob properly', async() => {
      let bin = await repo.loadRaw(blobHash)
      let obj = codec.deframe(bin, true);
      assert.equal(obj.type, 'blob', 'Wrong type');
      assert.equal(bodec.toUnicode(obj.body), bodec.toUnicode(blob), 'Wrong body');
    });
  });

  describe('loadAs', () => {
    it('should load blob with hash', async() => {
      let body = await repo.loadAs("blob", blobHash);
      assert.equal(bodec.toUnicode(body), bodec.toUnicode(blob), 'Wrong body');
    });
  });

  describe('saveRaw', () => {
    it('should save binary body', async() => {
      let newBody = bodec.fromUnicode("A new body\n");
      let bin = codec.frame({ type:"blob", body: newBody });
      let hash = sha1(bin);
      await repo.saveRaw(hash, bin);

      let body = await repo.loadAs("blob", hash);
      assert.equal(bodec.toUnicode(body), bodec.toUnicode(newBody), 'Body mismatch')
    });
  });
});
