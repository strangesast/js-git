import modes from '../lib/modes';
import { Repo } from './repo';

type validType = 'blob'|'tree'|'commit'|'tag';

export class CreateTree {
  loadAs: (type: validType, hash: string) => any;

  async createTree(entries) {
    if (!Array.isArray(entries)) {
      entries = Object.keys(entries).map((path) => Object.assign(entries[path], { path }));
    }

    let tree = entries.base && await this.loadAs('tree', entries.base) || {};
    let blobs = {};

    for (let entry of entries) {
      let fullpath = entry.path;
      let i = fullpath.lastIndexOf('/');
      let [path, fname] = [fullpath.substring(0, i).split('/'), fullpath.substring(i + 1)];
      let prev = tree;
      for (let dirname of path) {
        let ob = prev[dirname];
        if (ob && ob.mode && ob.hash) {
          prev = prev[dirname] = await this.loadAs('tree', ob.hash);
        } else if (dirname != '') {
          prev = prev[dirname] = (prev[dirname] || {});
        }
        // if dirname == '', in root so don't change prev
      }

      // added / modified
      if (entry.mode) {
        prev[fname] = fullpath;
        blobs[fullpath] = (async function({ mode, content }) {
          let type = modes.toType(mode);
          return { hash: await this.saveAs(type, content), mode };
        }).call(this, entry);
      }
      // removed
      else {
        delete prev[fname];
      }
    }

    return collapse(this, tree, blobs);
  }
}

async function collapse(repo, root, blobs) {
  for (let name in root) {
    let val = root[name];
    if (val.mode && val.hash) continue;
    if (typeof val === 'string') {
      root[name] = await blobs[val];

    } else {
      let hash = await collapse(repo, root[name], blobs);
      let mode = modes.tree;
      root[name] = { hash, mode };
    }
  }
  return repo.saveAs('tree', root);
}
