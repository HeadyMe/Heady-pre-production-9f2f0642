import json, urllib.request
repos = [
    'HeadyMe/headyos-core',
    'HeadyMe/headysystems-core',
    'HeadyMe/Heady-pre-production-9f2f0642',
    'HeadyMe/headysystems-production'
]
headers={'User-Agent':'Mozilla/5.0'}
for repo in repos:
    url=f'https://api.github.com/repos/{repo}'
    req=urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data=json.load(r)
        print(json.dumps({
            'repo': repo,
            'default_branch': data.get('default_branch'),
            'size': data.get('size'),
            'language': data.get('language'),
            'description': data.get('description'),
            'html_url': data.get('html_url'),
            'clone_url': data.get('clone_url'),
            'pushed_at': data.get('pushed_at')
        }))
    except Exception as e:
        print(json.dumps({'repo': repo, 'error': str(e)}))