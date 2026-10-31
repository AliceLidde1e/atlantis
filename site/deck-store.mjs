import {validateLocalState} from './core.mjs?v=20261031a';

// Saved decks are canonical in IndexedDB. Keep the existing localStorage key
// as a compatibility copy for the older MO import screen; never delete it.
export async function openDeckStore(legacyStorage, legacyKey, databaseName='atlantis.my-decks.v1') {
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
        const raw = legacyStorage.getItem(legacyKey), previous = request.result;
        let data = previous ? validateLocalState(previous.data) : validateLocalState(raw ? JSON.parse(raw) : {version:2,decks:[],trash:[]});
        // An older MO screen may have appended a deck to the compatibility copy.
        // Merge additions/newer records; do not delete canonical saved decks.
        if (previous && raw !== previous.raw && raw !== null) {
          const incoming = validateLocalState(JSON.parse(raw));
          const trashIds = new Set(data.trash.map(d => d.id));
          const merged = new Map(data.decks.map(d => [d.id, d]));
          for (const deck of incoming.decks) {
            const current = merged.get(deck.id);
            if (!trashIds.has(deck.id) && (!current || deck.updated > current.updated)) merged.set(deck.id, deck);
          }
          data = validateLocalState({...data,decks:[...merged.values()]});
        }
        const changed=!previous || raw!==previous.raw || JSON.stringify(data)!==JSON.stringify(previous.data);
        const record = {data,raw,revision:(previous?.revision || 0) + (changed?1:0)};
        store.put(record, 'current'); revision = record.revision; done({data,raw});
      } catch (error) { fail(error); }
    };
  });
  const commit = data => transaction('state', 'readwrite', (store, done, fail) => {
    const valid = validateLocalState(data), request = store.get('current');
    request.onsuccess = () => {
      if (request.result?.revision !== revision) { fail(new Error('別のタブで保存内容が変わりました。保存先を再読込してください。')); return; }
      const raw = JSON.stringify(valid), nextRevision = revision + 1;
      store.put({data:valid,raw,revision:nextRevision}, 'current');
      done({data:valid,raw,revision:nextRevision});
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
