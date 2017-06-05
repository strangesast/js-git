import { Repo, applyMixins } from '../mixins';
import { Formats, CreateTree, MemDB } from '../mixins';
import modes from '../lib/modes';

var dbName = 'testt';

var TEST_ENTRY = {
  path: 'www/index.html',
  mode: modes.file,
  content: '<h1>Hello</h1>\n<p>This is an HTML page?</p>\n'
}

class SpecialRepo implements Formats, CreateTree, MemDB, Repo {
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
applyMixins(SpecialRepo, [Formats, CreateTree, MemDB]);

describe('create-tree mixin', () => {
  var db;
  var repo = new SpecialRepo();

  describe('createTree', () => {
    it('should create first tree', test(async() => {
      let treeHash = await repo.createTree([ TEST_ENTRY ]);

      let tree = await repo.loadAs('tree', treeHash);

      expect(tree).toBeTruthy(); // 'failed to retrieve tree'
      expect(tree.www).toBeTruthy();
      expect(tree.www.mode).toEqual(modes.tree); // 'incorrect creation of folder'

      let folder = await repo.loadAs('tree', tree.www.hash);

      let fname = TEST_ENTRY.path.substring(TEST_ENTRY.path.lastIndexOf('/') + 1);

      expect(folder[fname]).toBeTruthy(); // 'failed to create file in folder'

      let content = await repo.loadAs(modes.toType(folder[fname].mode), folder[fname].hash);

      expect(TEST_ENTRY.content).toEqual(String.fromCharCode(...content)); // 'blob saved incorrectly'
    }));
  });
});
function test(run) {
  return (done) => {
    run().then(done, e => { done.fail(e); done(); });
  };
}
