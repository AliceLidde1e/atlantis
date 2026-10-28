"""Regression tests for selection policy, independent of API availability."""
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('prints',Path(__file__).with_name('rebuild-printings.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base=dict(id='normal',oracle_id='card',lang='en',released_at='2003-02-03',set='lgn',collector_number='86',
          games=['paper'],finishes=['nonfoil','foil'],promo=False,set_type='expansion',
          image_uris={'normal':'https://example.test/normal.jpg'},scryfall_uri='https://example.test/card')
promo={**base,'id':'promo','promo':True,'finishes':['foil'],'released_at':'2003-01-01','set_type':'promo'}
assert m.select([promo,base],'en','2026-10-24')['target']['id']=='normal'
assert m.select([base,promo],'en','2026-10-24')['target']['id']=='normal'
assert m.select([promo],'en','2026-10-24')['target']['id']=='promo'
assert m.select([promo],'en','2026-10-24')['candidates'][0]['image']
missing={**base,'image_status':'missing'}
assert m.select([promo,missing],'en','2026-10-24')['target']['id']=='normal'
assert m.select([promo,missing],'en','2026-10-24')['candidates'][0]['id']=='promo'
new={**base,'id':'new','set':'new','released_at':'2020-01-01'}
assert m.select([base,new],'en','2026-10-24')['target']['id']=='normal'
assert m.select([{**base,'lang':'ja'},{**new,'lang':'ja'}],'ja','2026-10-24')['target']['id']=='new'
# Pre-Modern printings do not decide the Japanese target set.
earliest={**base,'id':'8ed-en','set':'8ed','set_type':'core','released_at':'2003-07-28'}
jp={**earliest,'id':'8ed-ja','lang':'ja'}
later={**jp,'id':'9ed-ja','set':'9ed','released_at':'2005-07-29'}
assert m.select([{**base,'lang':'ja'},earliest,jp,later],'ja','2026-10-24')['target']['id']=='8ed-ja'
missing_jp=m.select([earliest,later],'ja','2026-10-24')
assert missing_jp['target'] is None and missing_jp['targetSet']=='8ed'
assert missing_jp['candidates'][0]['id']=='8ed-en'
assert not m.modern_set({**earliest,'set':'mma','set_type':'masters'})
assert not m.modern_set({**earliest,'set':'brr','set_type':'masterpiece'})
assert m.modern_set({**earliest,'set':'mh2','set_type':'draft_innovation'})
assert not m.eligible({**base,'games':['mtgo'],'digital':True},'2026-10-24')
assert not m.eligible({**base,'released_at':'2099-01-01'},'2026-10-24')
assert not m.regular({**base,'layout':'reversible_card'})
assert len(m.select([base,new,promo],'en','2026-10-24')['candidates'])==3
print('Printing builder: date cannot outrank nonfoil/normal, relaxed candidates retained, image-less ideal target and language date order OK')
