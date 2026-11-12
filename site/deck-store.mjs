import {validateLocalState} from './core.mjs?v=20261113deckview';

// Current decks and drafts live only in this IndexedDB database.
export async function openDeckStore(databaseName='atlantis.my-decks.v1') {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('state');
      request.result.createObjectStore('drafts');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('別のタブを閉じて保存領域を再読込してください。'));
  });
  db.onversionchange = () => db.close();
  const transaction = (store, mode, operation) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode); let result, failure;
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('保存処理に失敗しました。'));
    try { operation(tx.objectStore(store), value => { result = value; }, error => { failure = error; tx.abort(); }); }
    catch (error) { failure = error; tx.abort(); }
  });
  let revision = 0;
  const read = () => transaction('state', 'readwrite', (store, done, fail) => {
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        const previous = request.result;
        const data = validateLocalState(previous ? previous.data : {version:2,decks:[],trash:[]});
        const record = {data,revision:previous?.revision || 0};
        if (!previous) store.put(record, 'current');
        revision = record.revision; done(record);
      } catch (error) { fail(error); }
    };
  });
  const commit = data => transaction('state', 'readwrite', (store, done, fail) => {
    const valid = validateLocalState(data), request = store.get('current');
    request.onsuccess = () => {
      if (request.result?.revision !== revision) { fail(new Error('別のタブで保存内容が変わりました。保存先を再読込してください。')); return; }
      const nextRevision = revision + 1;
      store.put({data:valid,revision:nextRevision}, 'current');
      done({data:valid,revision:nextRevision});
    };
  }).then(result => { revision = result.revision; return result; });
  return {
    read, commit,
    putDraft: (key, value) => transaction('drafts','readwrite',(store, done) => { store.put(value,key); done(); }),
    deleteDraft: key => transaction('drafts','readwrite',(store, done) => { store.delete(key); done(); }),
    drafts: () => transaction('drafts','readonly',(store, done) => { const r=store.getAll();r.onsuccess=()=>done(r.result); }),
    close: () => db.close()
  };
}
