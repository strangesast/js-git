import {} from 'jasmine';
import * as sha1 from 'js-sha1';

import { test } from './util';
import { modes, frame, deframe } from '../src/lib';
import { IndexedDB, Formats } from '../src/mixins';

describe('indexeddb setup', () => {
  it('should create database connection', test(async() => {
    let repo = new IndexedDB('test');

    await repo.init('test-db', 1);

    expect(repo.db).toBeDefined();
    expect(repo.db).toEqual(jasmine.any(IDBDatabase));
  }));
});

describe('objects', () => {
  let repo = new (Formats(IndexedDB))('test-prefix');

  let object = { name: 'Carl', occupation: 'physicist' };
  let objectHash = 'a28407111c8362b945bc588f364f35968cbc99f1';
  var text = 'Hello World\n';
  var blobHash = '557db03de997c86a4a028e1ebd3a1ceb225be238';

  beforeEach(test(async() => {
    await repo.init('test-db');
    await repo.reset();
  }));

  describe('saveAs', () => {
    it('should save blob', test(async() => {
      let hash1 = await repo.saveAs('blob', object);
      let hash2 = await repo.saveAs('blob', text);

      expect(hash1).toBe(objectHash, 'failed to save object correctly');
      expect(hash2).toBe(blobHash, 'failed to save blob correctly');
    }));
    it('should save tree', test(async() => {
      let blobHash = await repo.saveAs('blob', object);
      let tree = {'test.json': { mode: modes.tree, hash: blobHash }};
      let treeHash = await repo.saveAs('tree', tree);
      expect(await repo.loadRaw(treeHash)).toEqual({ body: tree, hash: treeHash, type: 'tree' });
    }));
    it('should save commit', test(async() => {
      let blobHash = await repo.saveAs('blob', object);
      let tree = {'test.json': { mode: modes.tree, hash: blobHash }};
      let treeHash = await repo.saveAs('tree', tree);
      let person = {
        name: "Tim Caswell",
        email: "tim@creationix.com"
      }
      let commit = {
        author: person,
        tree: treeHash,
        message: "Test commit\n"
      };
      let commitHash = await repo.saveAs('commit', commit);
      let stored = await repo.loadRaw(commitHash);
      expect(stored).toBeDefined();
      expect(stored.body.author).toBeDefined();
      expect(stored.body.committer).toBeDefined();
      expect(stored.body.tree).toBeDefined();
      expect(stored.body.message).toBeDefined();
      expect(stored.body.parents).toBeDefined();
    }));
  });
  describe('saveRaw', () => {
    it('should save blob', test(async() => {
    }));
    it('should save tree', test(async() => {
    }));
    it('should save commit', test(async() => {
    }));
    it('should save commit as blob', test(async() => {
    }));
  });
  describe('loadAs', () => {
    it('should load commit', test(async() => {
    }));
    it('should load tree', test(async() => {
    }));
    it('should load blob', test(async() => {
    }));
    it('should fail to load tree as blob', test(async() => {
    }));
  });
  describe('loadRaw', () => {
    it('should load object', test(async() => {
      let hash = await repo.saveAs('blob', object);
      let record = await repo.loadRaw(hash);

      expect(record).toEqual({ hash, type: 'blob', body: object });
    }));
  });
});

describe('refs', () => {
  describe('readRef', () => {
  });
  describe('updateRef', () => {
  });
});
