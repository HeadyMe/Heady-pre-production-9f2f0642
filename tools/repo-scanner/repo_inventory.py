import os, json
root='/home/user/workspace/Heady-pre-production-9f2f0642-main'
counts={
  'total_files':0,
  'js_files':0,
  'ts_files':0,
  'test_files':0,
}
subdirs=['src/orchestration','src/security','src/services','src/gateway','src/vsa','src/bees','src/mcp','src/resilience','tests']
subcounts={k: {'files':0,'js':0,'ts':0} for k in subdirs}
for dirpath, dirnames, filenames in os.walk(root):
    for f in filenames:
        counts['total_files'] += 1
        path=os.path.join(dirpath,f)
        rel=os.path.relpath(path, root).replace('\\','/')
        if f.endswith('.js'): counts['js_files'] += 1
        if f.endswith('.ts'): counts['ts_files'] += 1
        if rel.startswith('tests/') and (f.endswith('.js') or f.endswith('.ts') or f.endswith('.mjs')):
            counts['test_files'] += 1
        for k in subdirs:
            if rel.startswith(k+'/') or rel == k:
                subcounts[k]['files'] += 1
                if f.endswith('.js'): subcounts[k]['js'] += 1
                if f.endswith('.ts'): subcounts[k]['ts'] += 1
print(json.dumps({'counts':counts,'subcounts':subcounts}, indent=2))