import { IRepo } from '../mixins/repo';
import { FormatsMixin } from '../mixins/formats';
import { CreateTreeMixin } from '../mixins/create-tree';
import { MemDBMixin } from '../mixins/mem-db';
///import { IRepo, FormatsMixin, CreateTreeMixin, MemDBMixin } from '../mixins';
import modes from '../lib/modes';

var dbName = 'testt';

var TEST_ENTRY = {
  path: 'www/index.html',
  mode: modes.file,
  content: '<h1>Hello</h1>\n<p>This is an HTML page?</p>\n'
}

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
class SpecialRepo extends FormatsMixin(CreateTreeMixin(MemDBMixin(Repo))) {}

describe('create-tree mixin', () => {
  var db;
  var repo = new SpecialRepo('testing');

  describe('createTree', async() => {
    it('should create first tree', async(done) => {
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

      done();
    });
  });
});
