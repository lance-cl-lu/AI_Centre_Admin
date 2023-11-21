cp -f ../frontend/build/index.html template/
rm -rf static/*
cp -a ../frontend/build/* static/
rm -f static/index.html
