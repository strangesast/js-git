import sha1 from 'git-sha1';
import { deflate } from 'pako';
import modes from '../lib/modes';
import { applyMixins, Repo, MemDB, IndexedDB, Formats, CreateTree, CreateZip } from '../mixins';

interface TreeChanges {
  base?: string;
}

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

for (let i = 0; i < 10; i++) {
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

class MemRepo implements CreateZip, CreateTree, Formats, MemDB, Repo {
  zip;
  createZip: (...branchNames) => Promise<any>;
  loadZip: (data, headOnly?) => Promise<void>;
  addBranch: (...branchNames) => Promise<void>;
  clear: () => void;
  flattenTree: (rootHash, prefix) => Promise<any>;
  objects = {};
  refs = {};
  refPrefix;
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
applyMixins(MemRepo, [CreateZip, CreateTree, Formats, MemDB]);
class IDBRepo implements CreateZip, CreateTree, Formats, IndexedDB, Repo {
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
  loadManyRaw: () => Promise<any>;
  hasHash: (hash) => Promise<boolean>;
  listRefs: (prefix) => Promise<any>;
  enumerateObjects: () => Promise<any[]>;
  readRef: (ref) => Promise<string>;
  updateRef: (ref, hash) => Promise<void>;
}
applyMixins(IDBRepo, [CreateZip, CreateTree, Formats, IndexedDB]);

describe('zip mixin', () => {
  var repo1 = new IDBRepo();
  var repo2 = new MemRepo();
  var db;
  var blob;

  var treeHash;

  describe('archive', () => {
    it('should create archive', test(async() => {
      db = await repo1.init('testt', 1);
      treeHash = await repo1.createTree(EXAMPLE_TREE);
      let tree = await repo1.loadAs('tree', treeHash);

      let commitHash = await repo1.saveAs('commit', {
        author: {
          name: 'Sam Zagrobelny',
          email: 'strangesast@gmail.com'
        },
        message: 'Test Committtttt',
        tree: treeHash
      });

      let changes: TreeChanges = Object.keys(ADDED).map(path => Object.assign({ path }, ADDED[path]));
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
      let zip = await repo1.createZip('master', 'master-backup');

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

    }));

    it('should read data from created archive into memory', test(async() => {
      await repo2.createTree(EXAMPLE_TREE);
      let zip = await repo2.createZip();
      await repo2.loadZip(blob);

      let commitHash = await repo2.readRef('master');
      expect(commitHash).toBeTruthy(); // 'Ref missing'

      let commit = await repo2.loadAs('commit', commitHash);
      expect(commit).toBeTruthy(); // 'Commit missing'

      let tree = await repo2.loadAs('tree', commit.tree);
      expect(tree).toBeTruthy(); // 'Root tree missing'

      let list = await repo2.flattenTree(repo2, commit.tree);
      let valid = Object.assign({}, EXAMPLE_TREE, ADDED)
      for (let { path } of list) {
        expect(valid).toContain(path.join('/')); // 'Path missing in example tree.'
      };
    }));

    xit('should retrieve and load zip file', test(async() => {
      let path = '/base/test.zip';
      let request = new Request(path);
      let response = await fetch(request);
      let blob = await response.blob();

      let repo = new MemRepo();
      await repo.createZip();
      await repo.loadZip(blob);
    }));
  });
});
function test(run) {
  return (done) => {
    run().then(done, e => { done.fail(e); done(); });
  };
}
