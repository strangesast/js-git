var assert = require('assert');
var indexeddbjs = require('indexeddb-js');
var sqlite3 = require('sqlite3');
var engine = new sqlite3.Database(':memory:');
var scope = indexeddbjs.makeScope('sqlite3', engine);
indexedDB = scope.indexedDB;
var bodec = require('bodec');

var idb =        require('../mixins/indexed-db.js');
var formats =    require('../mixins/formats.js');
var modes =      require('../lib/modes.js');
var createTree = require('../mixins/create-tree.js');

var dbName = 'test';

var TEST_ENTRY = {
  path: 'www/index.html',
  mode: modes.file,
  content: '<h1>Hello</h1>\n<p>This is an HTML page?</p>\n'
}


describe('create-tree mixin', () => {
  var db;
  var repo = {};

  before(async() => {
    db = await idb.init(dbName, 1);
    idb(repo, 'testing');
    formats(repo);
    createTree(repo);
  });

  describe('createTree', () => {
    it('should create first tree', async() => {
      let treeHash = await repo.createTree([ TEST_ENTRY ]);

      let tree = await repo.loadAs('tree', treeHash);
      assert(tree, 'failed to retrieve tree');
      assert.equal(tree.www && tree.www.mode, modes.tree, 'incorrect creation of folder');

      let folder = await repo.loadAs('tree', tree.www.hash);

      let fname = TEST_ENTRY.path.substring(TEST_ENTRY.path.lastIndexOf('/') + 1);

      assert(folder[fname], 'failed to create file in folder');

      let content = await repo.loadAs(modes.toType(folder[fname].mode), folder[fname].hash);
      assert.equal(TEST_ENTRY.content, String.fromCharCode(...content.data), 'blob saved incorrectly');
    });
  });

  after(function() {
    if (db) {
      db.close();
    }
  });
});
