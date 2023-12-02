echo "Packaging extension for submission to the Chrome Web Store."

rm -rf deploy/ GalacTex.zip

zip -r GalacTex.zip ./* -x .git/**\* -x .idea/**\* -x .gitignore -x deploy/**\* -x README.md -x deploy.sh

mkdir deploy/
unzip -o GalacTex.zip -d deploy/