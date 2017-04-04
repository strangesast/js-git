import {} from 'jasmine';
import sha1 from 'git-sha1';
import { deflate } from 'pako';
import modes from '../lib/modes';
import { IRepo, MemDBMixin, IndexedDBMixin, FormatsMixin, CreateTreeMixin, CreateZipMixin } from '../mixins';

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
class MemRepo extends CreateZipMixin(CreateTreeMixin(FormatsMixin(MemDBMixin(Repo)))) {}
class IDBRepo extends CreateZipMixin(CreateTreeMixin(FormatsMixin(IndexedDBMixin(Repo)))) {}

describe('zip mixin', async() => {
  var repo1 = new IDBRepo('test-a');
  var repo2 = new MemRepo('test-b');
  var db = await repo1.init('testt', 1);
  var blob;

  var treeHash = await repo1.createTree(EXAMPLE_TREE);

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

    });

    it('should read data from created archive into memory', async() => {
      await repo2.createTree(EXAMPLE_TREE);
      let zip = await repo2.zip.create();
      await repo2.zip.load(blob);

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
    });
  });
});
