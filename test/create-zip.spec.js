var assert = require('assert');
var sha1 = require('git-sha1');
var { deflate } = require('pako');

var codec =      require('../lib/object-codec.js');
var modes =      require('../lib/modes.js');
var memdb =      require('../mixins/mem-db.js');
var idb =        require('../mixins/indexed-db.js');
var formats =    require('../mixins/formats.js');
var createTree = require('../mixins/create-tree.js');
var createZip =  require('../mixins/create-zip.js');

var EXAMPLE_TREE = {
  'www/index.html': {
    mode: modes.file,
    content: '<h1>Hello</h1>\n<p>This is an HTML page?</p>\n'
  },
  'README.md': {
    mode: modes.file,
    content: '# Sample repo\n\nThis is a sample\n'
  }
};

for (let i = 0; i < 100; i++) {
  EXAMPLE_TREE[`www/file${ i }.html`] = {
    mode: modes.file,
    content: `<h1>Hello</h1>\n<p>This is an file ${ i }?</p>\n`
  };
}

var ADDED = {
  'www/toastTOASTtoast.html' : {
    mode: modes.file,
    content: `<html><body>TOAST ${ Math.floor(Math.random()*100) }</body></html>`
  }
};

var dbName = 'test';

describe('zip mixin', function() {
  var db;
  var repo1 = {};
  var repo2 = {};
  var treeHash;
  var blob;

  before(async() => {
    //memdb(repo);
    db = await idb.init('testt', 1);
    idb(repo1, 'testing');
    memdb(repo2)
    formats(repo1);
    formats(repo2);
    createTree(repo1);
    createTree(repo2);
    createZip(repo1);
    createZip(repo2);

    treeHash = await repo1.createTree(EXAMPLE_TREE);
  });

  describe('archive', () => {
    it('should create archive', async() => {
      let tree = await repo1.loadAs('tree', treeHash);

      let commitHash = await repo1.saveAs('commit', {
        author: {
          name: 'Sam Zagrobelny',
          email: 'strangesast@gmail.com'
        },
        message: 'Test Committtttt',
        tree: treeHash
      });

      let changes = Object.keys(ADDED).map(path => Object.assign({ path }, ADDED[path]));
      changes.base = treeHash;

      let newTree = await repo1.createTree(changes);

      let secondCommitHash = await repo1.saveAs('commit', {
        author: {
          name: 'Sam Zagrobelny',
          email: 'strangesast@gmail.com'
        },
        message: 'Second Test Committtttt',
        tree: newTree,
        parents: [ commitHash ]
      });

      await repo1.updateRef('master-backup', commitHash);
      await repo1.updateRef('master', secondCommitHash);

      // test creating a few branches
      let zip = await repo1.zip.create('master', 'master-backup');

      blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

      /*
      let url = window.URL.createObjectURL(blob);
      let link = window.document.createElement('a');
      link.download = 'test.zip';
      link.textContent = 'Download';
      link.href = url;
      window.document.body.appendChild(link);
      link.click();
      */

    }).timeout(10000);

    it('should read data from created archive into memory', async() => {
      let zip = await repo2.zip.create();
      await repo2.zip.load(blob);

      let commitHash = await repo2.readRef('master');
      assert(commitHash, 'Ref missing');

      let commit = await repo2.loadAs('commit', commitHash);
      assert(commit, 'Commit missing');

      let tree = await repo2.loadAs('tree', commit.tree);
      assert(tree, 'Root tree missing');

      let list = await createZip.flatten(repo2, commit.tree);
      let valid = Object.assign({}, EXAMPLE_TREE, ADDED)
      for (let { path } of list) {
        assert(path.join('/') in valid, 'Path missing in example tree.');
      };
    });
  });
});

/*
function test(fn, n=1) {
  let start = window.performance.now();
  do {
    fn();
  } while (--n > 0)
  return window.performance.now() - start;
}
*/
