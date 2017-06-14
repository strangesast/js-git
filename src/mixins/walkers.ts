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
  }
}
