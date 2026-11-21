"""Builds the bundled data for the Beyt iOS app from the prototype's data files.
Usage: python3 build_data.py <data.json> <allp.json> <books-text.json> <out-dir> [ganjoor-data checkout]
The optional ganjoor-data checkout (github.com/ganjoor/ganjoor-data) supplies full poet biographies.
"""
import json, sys, os, re

data = json.load(open(sys.argv[1]))
allp = json.load(open(sys.argv[2]))
books = json.load(open(sys.argv[3]))
out = sys.argv[4]

def clean(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()

poems = {}
for bk, lst in books.items():
    for p in lst:
        poems[p['url']] = {
            'u': p['url'], 't': p['title'], 's': clean(p.get('sum')), 'sa': 1 if p.get('sumAi') else 0,
            'me': p.get('metre') or '', 'r': p.get('rhyme') or '', 'f': p.get('fmt') or '',
            'c': [[c[0], c[1], clean(c[2]), 1 if (len(c) > 3 and c[3]) else 0] for c in p['c']],
        }
for p in data['poems']:
    poems[p['url']] = {
        'u': p['url'], 't': p['title'], 's': clean(p.get('sum')), 'sa': 1 if p.get('sumAi') else 0,
        'me': p.get('metre') or '', 'r': p.get('rhyme') or '', 'f': p.get('fmt') or '',
        'c': [[c[0], c[1], clean(c[2]), 1 if (len(c) > 3 and c[3]) else 0] for c in p['c']],
        'tot': p.get('total') or len(p['c']),
        'rec': p.get('rec') or [], 'nr': p.get('nRec') or 0,
        'so': [{'a': s.get('artist', ''), 't': s.get('track', ''), 'al': s.get('album', '')} for s in (p.get('songs') or [])],
        'ns': p.get('nSongs') or 0,
    }

poets = []
for a in allp:
    x = data['poets'].get(a['s'], {})
    poets.append({
        's': a['s'], 'n': a['n'], 'f': a.get('f') or '', 'd': a.get('d') or 0, 'bp': a.get('bp') or '',
        'dp': x.get('dp') or '', 'by': x.get('b') or 0, 'bio': clean(x.get('bio') or a.get('bio') or ''),
        'b': [{'t': b[0], 'u': b[1], 'n': b[2]} for b in (a.get('b') or [])], 'pin': a.get('pin') or 0,
    })

if len(sys.argv) > 5:
    for x in poets:
        f = os.path.join(sys.argv[5], 'poets', x['s'], 'poet.json')
        if os.path.exists(f):
            d = clean(re.sub(r'<[^>]+>', '', json.load(open(f)).get('Description') or ''))
            if len(d) > len(x['bio']): x['bio'] = d

os.makedirs(out, exist_ok=True)
json.dump(sorted(poems.values(), key=lambda p: p['u']), open(os.path.join(out, 'poems.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(poets, open(os.path.join(out, 'poets.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('poems', len(poems), 'poets', len(poets))
