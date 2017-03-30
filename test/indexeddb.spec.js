var assert = require('assert');

/*
if (!indexedDB) {
  var indexeddbjs = require('indexeddb-js');
  var sqlite3 = require('sqlite3');
  var engine = new sqlite3.Database(':memory:');
  var scope = indexeddbjs.makeScope('sqlite3', engine);

  indexedDB = scope.indexedDB;
}
*/

var bodec = require('bodec');
var codec = require('../lib/object-codec.js');
var modes = require('../lib/modes.js');
var idb = require('../mixins/indexed-db.js');
var formats = require('../mixins/formats.js');

var blob = bodec.fromUnicode("Hello World\n");
var blobHash = "557db03de997c86a4a028e1ebd3a1ceb225be238";
var treeHash = 'c0527a06bdca1031041a1b0a5195bdec38c4e68d';
var dbName = 'test';
var fname = 'test.txt';

describe('indexeddb mixin', () => {
  var db;
  var repo = {};
  var commitHash;

  before(async() => {
    db = await idb.init(dbName, 1);
    idb(repo, 'testing');
    formats(repo);
  });

  describe('saveAs', () => {
    it('should save blob', async() => {
      let hash = await repo.saveAs('blob', blob);
      assert.equal(hash, blobHash, 'blob saved incorrectly');
    });

    it('should save tree', async() => {
      let hash = await repo.saveAs('tree', {
        [fname]: { hash: blobHash, mode: modes.tree }
      });
      assert.equal(treeHash, hash, 'tree was saved incorrectly');
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
      assert.ok(commitHash, 'failed to save');
    });
  });

  describe('loadAs', () => {
    it('should load each type of data', () => {
      it('should load a commit', async() => {
        let commit = await repo.loadAs('commit', commitHash);
        assert.ok(commit, 'failed to load');
        assert.equal(commit.tree, treeHash);
      });

      it('should load a tree', async() => {
        let tree = await repo.loadAs('tree', treeHash);
        assert(tree[fname]);
      });

      it('should load a blob', async() => {
        assert.equal(blob, await repo.loadAs('blob', blobHash));
      });
    });

    it('should fail to load a mismatched type', () => repo.loadAs('commit', treeHash).then(() => {
      throw new Error('failed to throw');
    }).catch(err => {
      assert.equal(err.message, 'Type mismatch');
    }));
  });

  describe('loadRaw', () => {
    let hashes = [];
    before(async() => {
      for( let i=0; i < 5; i++) {
        hashes.push(await repo.saveAs('blob', `Test ${ i }\n`));
      }
    });
    it('should load byte array', async() => {
      let data = await repo.loadRaw(hashes[0]);
      assert.equal('Test 0\n', String.fromCharCode(...data.body));
    });
    /* the following isn't implemented in indexeddb-js
    it('should load multiple byte arrays', async() => {
      let data = await repo.loadManyRaw(hashes);
      assert.equal(hashes.length, data.length);
    });
    */
  })

  describe('update/readRef', () => {
    it('should add ref for hash', async() => {
      await repo.updateRef('testRef', commitHash);
    });
    it('should return null for nonexistant ref', async() => {
      let ref = await repo.readRef('toastRef');
      assert.equal(ref, null);
    });
    it('should read correct hash', async() => {
      let ref = await repo.readRef('testRef');
      assert.equal(ref, commitHash);
    });
  })

  describe('hasHash', () => {
    it('should verify that hash was saved for blob', async() => {
      assert.ok(await repo.hasHash(blobHash), 'Hash was not saved for blob');
    });
  })

  after(function() {
    if (db) {
      db.close();
    }
  });
});
