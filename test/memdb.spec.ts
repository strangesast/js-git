import {} from 'jasmine';
import * as sha1 from 'js-sha1';

import { test } from './util';
import { modes, frame, deframe, applyMixins } from '../src/lib';
import { MemDB, Formats } from '../src/mixins';

describe('memdb', () => {
  let repo = new (Formats(MemDB))('testtt');

  var blob = new TextEncoder().encode('Hello World\n');
  var blobHash = '557db03de997c86a4a028e1ebd3a1ceb225be238';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  describe('saveAs', () => {
    it ('should save blob', test(async () => {
      let hash = await repo.saveAs('blob', blob);
      expect(hash).toBe(blobHash);
    }));

    it ('should save blob, tree & commit', test(async () => {
      let json = JSON.stringify({ toast: 'toast' });
      let blobHash = await repo.saveAs('blob', json);
      let tree = { 'toast.json': { mode: modes.blob, hash: blobHash }};
      let treeHash = await repo.saveAs('tree', tree);
      let commit = {
        author: {
          name: 'Toast',
          email: 'me@toast.toast'
        },
        tree: treeHash,
        message: 'toast?'
      };
      let commitHash = await repo.saveAs('commit', commit);
      expect(commitHash).toBeTruthy();
    }));
  });

  describe('loadRaw', () => {
    it ('should load from encoded blob', test(async () => {
      let bin = await repo.loadRaw(blobHash);
      var { type, body } = deframe(bin, true);
      expect(type).toBe('blob');
      expect(decoder.decode(body)).toEqual(decoder.decode(blob));
    }));
  });
  
  describe('loadAs', () => {
    it ('should load blob as blob', test(async () => {
      let body = await repo.loadAs('blob', blobHash);
      expect(decoder.decode(body)).toEqual(decoder.decode(blob));
    }));
  });

  describe('saveRaw', () => {
    it ('should save raw buffer', test(async () => {
      var newBody = new TextEncoder().encode('A new body\n');
      var bin = frame({ type:'blob', body:newBody });
      var hash = sha1(bin);
      await repo.saveRaw(hash, bin);
      let body = await repo.loadAs('blob', hash);

      expect(decoder.decode(body)).toEqual(decoder.decode(newBody));
    }));
  });
});
