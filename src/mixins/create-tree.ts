import { Repo } from './repo';
import { modes } from '../lib';

type Constructor<T = {}> = new (...args: any[]) => T;
const pathSeparator = '/';

export function CreateTree<T extends Constructor<Repo>>(Base: T) {
  return class extends Base {
    async createTree(entries) {
      let self = this;
      if (!Array.isArray(entries)) {
        entries = Object.keys(entries).map((path) => Object.assign({}, entries[path], { path }));
      }
    
      // Tree paths that we need loaded
      var toLoad = {};

      // Commands to run organized by tree path
      var trees = {};
      var blobs = [];
 
      function markTree(path) {
        while(true) {
          if (toLoad[path]) return;
          toLoad[path] = true;
          trees[path] = {
            add: [],
            del: [],
            tree: {}
          };
          if (!path) break;
          path = path.substring(0, path.lastIndexOf('/'));
        }
      }
    
      // First pass, stubs out the trees structure, sorts adds from deletes,
      // and saves any inline content blobs.
      for (let { path, mode, hash, content } of entries) {
        let index = path.lastIndexOf('/');
        let parentPath = path.substring(0, index);
        let name = path.substr(index + 1);
        markTree(parentPath);
        let tree = trees[parentPath];
    
        if (!mode) {
          tree.del.push(name);
          continue;
        }
        var add = { name, mode, hash };
        tree.add.push(add);
        if (hash) continue;

        blobs.push({ add, content });
      }

      async function loadTree (path, hash) {
        let tree = await self.loadAs('tree', hash);
        trees[path].tree = tree;
        delete toLoad[path];
        for (let name in tree) {
          let childPath = path ? path + '/' + name : name;
          if (toLoad[childPath]) {
            await loadTree(childPath, tree[name].hash);
          }
        }
      }

      let blobHashes = await this.saveMany(blobs.map(({ content }) => ({ type: 'blob', body: content })))
      for (let i=0; i < blobHashes.length; i++) {
        blobs[i].add.hash = blobHashes[i];
      }

      if (entries.base) {
        loadTree('', entries.base);
      }

      function findLeaves() {
        let paths = Object.keys(trees);
        let parents = {};
        for (let path of paths) {
          if (!path) continue;
          let parent = path.substring(0, path.lastIndexOf(pathSeparator));
          parents[parent] = true;
        }
        return paths.filter(path => !parents[path]).sort(function(a, b) {
          return a === '' ? 1 : -1;
        });
      }

      let leaves = findLeaves();
      while (leaves.length) {
        let newTrees = [];
        for (let path of leaves) {
          let entry = trees[path];
          delete trees[path];
          let tree = entry.tree;
          for (let name of entry.del) {
            delete tree[name];
          }
          for (let { name, mode, hash } of entry.add) {
            tree[name] = { hash, mode };
          }
          newTrees.push({ type: 'tree', body: tree });
        }
        let treeHashes = await this.saveMany(newTrees);

        for (let i=0; i < treeHashes.length; i++) {
          let path = leaves[i];
          let hash = treeHashes[i];
          if (!path) {
            if (Object.keys(trees).length > 0) throw new Error('unfinshed!');
            return hash;
          }
          let index = path.lastIndexOf(pathSeparator);
          let parentPath = path.substring(0, index);
          let name = path.substring(index + pathSeparator.length)
          trees[parentPath].add.push({
            hash,
            name,
            mode: modes.tree
          });
        }
        leaves = findLeaves();
      }
    }
  }
}
//function singleCall(callback) {
//  var done = false;
//  return function () {
//    if (done) return console.warn('Discarding extra callback');
//    done = true;
//    return callback.apply(this, arguments);
//  };
//}
