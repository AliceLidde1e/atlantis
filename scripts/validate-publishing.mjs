import {readFileSync} from 'node:fs';
import {validatePublishingData} from '../site/publishing.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../site/data/'+name+'.json',import.meta.url),'utf8'));
const data={cards:load('cards').cards,events:load('events'),results:load('results'),decks:load('decks')};
const errors=validatePublishingData(data);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Publishing data OK: ${data.events.length} events, ${data.results.length} results, ${data.decks.length} decks`);
