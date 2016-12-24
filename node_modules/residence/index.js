/**
 * Created by amills001c on 3/1/16.
 */



const path = require('path');
const fs = require('fs');

module.exports = {


    findProjectRoot: function findRoot(pth) {


        var possiblePkgDotJsonPath = path.resolve(path.normalize(String(pth) + '/package.json'));

        try {
            fs.statSync(possiblePkgDotJsonPath).isFile();
            return pth;
        }
        catch (err) {
            var subPath = path.resolve(path.normalize(String(pth) + '/../'));
            if (subPath === pth) {
                return null;
            }
            else {
                return findRoot(subPath);
            }
        }

    }


};