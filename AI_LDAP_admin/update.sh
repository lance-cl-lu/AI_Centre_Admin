cp -f ../frontend/build/index.html frontend/templates/frontend/
rm -rf static/*
cp -a ../frontend/build/* static/
rm -f static/index.html

sed -i 's/"\/manifest.json"/"{% static "\/manifest.json" %}"/' frontend/templates/frontend/index.html 
sed -i 's/"\/static\/js\/main./"{% static "\/static\/js\/main./' frontend/templates/frontend/index.html
sed -i 's/.js"/.js" %}"/' frontend/templates/frontend/index.html 
sed -i 's/"\/static\/css\/main./"{% static "\/static\/css\/main./' frontend/templates/frontend/index.html
sed -i 's/.css"/.css" %}"/' frontend/templates/frontend/index.html 

