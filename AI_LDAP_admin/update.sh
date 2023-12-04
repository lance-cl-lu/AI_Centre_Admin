cp -f ../frontend/build/index.html template/
rm -rf static/*
cp -a ../frontend/build/* static/
rm -f static/index.html

sed -i 's/"\/manifest.json"/"{% static "\/manifest.json" %}"/' template/index.html 
sed -i 's/"\/static\/js\/main./"{% static "\/static\/js\/main./' template/index.html
sed -i 's/.js"/.js" %}"/' template/index.html 
sed -i 's/"\/static\/css\/main./"{% static "\/static\/css\/main./' template/index.html
sed -i 's/.css"/.css" %}"/' template/index.html 

cp template/index.html frontend/templates/frontend/index.html
