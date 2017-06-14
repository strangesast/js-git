import 'core-js/shim';
import { Repo } from './repo';
import { modes } from '../lib';

type Constructor<T = {}> = new (...args: any[]) => T;

export function Walkers<T extends Constructor<Repo>>(Base: T) {
  return class extends Base {
    async *walkCommits(hash) {
      let commit = await this.loadAs('commit', hash);
      let parents = commit.parents;
      do {
        if (!commit) throw new Error('invalid hash reference');
        yield commit;
        commit = await this.loadAs('commit', commit.parents[0]);
      } while (commit && commit.parents.length == 1);
      yield commit;
      if (commit.parents.length > 1) {
        return 1;
      }
      return 0;
    }

    async *walkTrees(hash) {
      let root = await this.loadAs('tree', hash);
      let tree = { root: null };

      let children = [{ object: { name: 'root', type: 'tree', body: root }, context: tree }];
      let depth = 0;

      while (children.length) {
        let toLoad = {};
        for (let { object, context } of children) {
          let { type, body, name } = object;
          if (type == 'tree') {
            let subtree = {};
            context[name] = subtree;
            for (let name in body) {
              let { hash, mode } = body[name];
              toLoad[hash] = { object: { name, type: modes.toType(mode), body: null }, context: subtree };
            }
          } else {
            context[name] = body;
          }
        }
        let hashes = Object.keys(toLoad);
        let objects = await this.loadMany(hashes);
        if (hashes.length != objects.length) throw new Error('missing child!');
        children = [];
        for (let i=0; i < hashes.length; i++) {
          let hash = hashes[i];
          let object = objects[i];
          toLoad[hash].object.body = object.body;
          children.push(toLoad[hash]);
        }

        yield tree.root;
      }
    }
  }
}
