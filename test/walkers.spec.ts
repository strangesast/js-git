import {} from 'jasmine';
import * as sha1 from 'js-sha1';

import { test } from './util';
import { modes, frame, deframe } from '../src/lib';
import { CreateTree, MemDB, IndexedDB, Formats, Walkers } from '../src/mixins';

describe('indexeddb walker', () => {
  let repo = new (CreateTree(Walkers(Formats(IndexedDB))))('testtttt');
  beforeEach(test(async () => {
    await repo.init('test-db');
    await repo.reset();
  }));

  it ('should walk commits', test(async () => {
    let person = {
      name: 'Toast',
      email: 'me@toast.toast'
    };
    let json = {toast: 'toast!'};
    let blobHash = await repo.saveAs('blob', json)
    expect(blobHash).toBeTruthy();
    let treeHash = await repo.saveAs('tree', { 'toast.json': { mode: modes.blob, hash: blobHash }});
    expect(treeHash).toBeTruthy();
    let commitHash = await repo.saveAs('commit', { author: person, tree: treeHash, message: 'first' });
    expect(commitHash).toBeTruthy();

    json.toast = 'toast?';
    blobHash = await repo.saveAs('blob', json);
    treeHash = await repo.saveAs('tree', { 'toast.json': { mode: modes.blob, hash: blobHash }});
    commitHash = await repo.saveAs('commit', { author: person, tree: treeHash, message: 'second', parents: [commitHash] });

    for await (const commit of repo.walkCommits(commitHash)) {
      console.log('commit', commit);
    }
  }));

  it ('should walk trees', test(async () => {
    let hash = await repo.createTree({
      'toast/toast.json': {
        mode: modes.blob,
        content: 'toast! - depth 0'
      },
      'toast/toast/toast.json': {
        mode: modes.blob,
        content: 'toast! - depth 1'
      },
      'toast/toast/toast/toast.json': {
        mode: modes.blob,
        content: 'toast! - depth 2'
      },
      'toast/toast/toast/toast/toast.json': {
        mode: modes.blob,
        content: 'toast! - depth 3'
      }
    });

    for await (const tree of repo.walkTrees(hash)) {
      console.log('tree', tree);
    }
  }));
});
