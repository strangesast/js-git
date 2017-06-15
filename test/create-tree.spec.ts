import {} from 'jasmine';
import * as sha1 from 'js-sha1';

import { test } from './util';
import { modes, frame, deframe } from '../src/lib';
import { MemDB, IndexedDB, Formats, Walkers, CreateTree } from '../src/mixins';

describe('create-tree', () => {
  it ('should create tree from readme - indexeddb', test(async() => {
    // create "special repo" with mixins
    const Repo = Walkers(CreateTree(Formats(IndexedDB)));
    
    // create instance of "special repo"
    let repo = new Repo('test');
    
    await repo.init('test-db')
    let treeHash = await repo.createTree({
      'www/index.html': {
        mode: modes.file,
        content: '<h1>Hello</h1>\n<p>This is an HTML page?</p>\n'
      },
      'README.md': {
        mode: modes.file,
        content: '# Sample repo\n\nThis is a sample\n'
      }
    });
    
    // load the root tree (just saved above)
    let utree = await repo.loadAs('tree', treeHash);
    expect(utree['README.md']).toBeDefined();
    expect(utree['www']).toBeDefined();
    
    // resolve tree iteratively
    let rtree;
    let gen = repo.walkTrees(treeHash)
    rtree = (await gen.next()).value;
    expect(rtree['www']).toBeUndefined();
    rtree = (await gen.next()).value;
    expect(rtree['www']).toBeDefined();
    expect(rtree['www']['index.html']).toBeUndefined();
    rtree = (await gen.next()).value;
    expect(rtree['www']['index.html']).toBeDefined();
  }));
  it ('should create tree from readme - memdb', test(async() => {
    // create "special repo" with mixins
    const Repo = Walkers(CreateTree(Formats(MemDB)));
    
    // create instance of "special repo"
    let repo = new Repo('test');
    
    let treeHash = await repo.createTree({
      'www/index.html': {
        mode: modes.file,
        content: '<h1>Hello</h1>\n<p>This is an HTML page?</p>\n'
      },
      'README.md': {
        mode: modes.file,
        content: '# Sample repo\n\nThis is a sample\n'
      }
    });
    
    // load the root tree (just saved above)
    let utree = await repo.loadAs('tree', treeHash);
    console.log('unresolved tree', utree);
    
    // resolve tree iteratively
    let rtree;
    let gen = repo.walkTrees(treeHash)
    rtree = (await gen.next()).value;
    rtree = (await gen.next()).value;
    rtree = (await gen.next()).value;
    console.log('resolved tree', rtree);
  }));

});
