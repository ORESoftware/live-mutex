module.exports = data => {

  return {

    //TODO: have to handle the case where the build has already been built - don't want to rebuild container

    // put in .suman/groups/scripts
    // if pathToScript is null/undefined, will read script with the same name as the group in the above dir

    groups: [

      {
        name: '',
        useContainer: true,
        build: '',           //the machine hopefully *already* has the build saved on the fs, so won't have to rebuild
        pathToScript: '',
        run: ''

      }

    ]
  }

};