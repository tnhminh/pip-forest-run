# Builds dist-artifact/index.html: the same game page without the outer html/head/body tags
# (the artifact host adds its own skeleton). Other files are published alongside unchanged.
import re, pathlib
src = pathlib.Path('www/index.html').read_text()
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
keep = [l for l in head.splitlines() if re.search(r'<title>|<link rel="stylesheet"|<meta name="description"', l)]
out = '\n'.join(keep) + '\n<meta name="claude:viewport-fit-sides" content="cover">\n' + body
pathlib.Path('dist-artifact').mkdir(exist_ok=True)
pathlib.Path('dist-artifact/index.html').write_text(out)
print(len(out))
