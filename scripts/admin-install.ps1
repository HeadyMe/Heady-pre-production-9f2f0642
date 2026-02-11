# Requires admin rights
New-Item -Path 'C:\Program Files\HeadyBrowser' -ItemType Directory -Force
Copy-Item 'c:\Users\erich\Heady\headybrowser-desktop\dist\*' 'C:\Program Files\HeadyBrowser\' -Recurse -Force
