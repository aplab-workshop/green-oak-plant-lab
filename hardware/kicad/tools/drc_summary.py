import json, collections, sys
d = json.load(open(sys.argv[1], encoding='utf-8'))
v = d['violations']
print(collections.Counter((x['severity'], x['type']) for x in v), 'unconnected', len(d.get('unconnected_items', [])))
for x in v:
    if x['type'] not in sys.argv[2:]:
        print(x['type'], '|', ' / '.join(i['description'][:50] for i in x['items']))
