import { test } from './util';
import {} from 'jasmine';
import { IndexedDB } from '../src/mixins/indexeddb';

describe('indexeddb setup', () => {
  it('should create database connection', test(async() => {
    let repo = new IndexedDB('test');

    await repo.init('test-db', 1);

    expect(repo.db).toBeDefined();
    expect(repo.db).toEqual(jasmine.any(IDBDatabase));
  }));
});

describe('objects', () => {
  let repo = new IndexedDB('test-prefix');

  beforeEach(test(async() => {
    await repo.init('test-db');
    await repo.reset();
  }));

  describe('saveAs', () => {
    it('should save blob', test(async() => {
      let hash1 = await repo.saveAs('blob', JSON.stringify({'name': 'Carl', 'occupation': 'Physicist'}));
      let hash2 = await repo.saveAs('blob', 'a blob');
      console.log(hash1, hash2);
    }));
    it('should save tree', test(async() => {
    }));
    it('should save commit', test(async() => {
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
    }));
  });
});

describe('refs', () => {
  describe('readRef', () => {
  });
  describe('updateRef', () => {
  });
});
