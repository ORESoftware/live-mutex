/**
 *
 *  Purpose of this file is to ensure suman.post hooks to be matched with suman.pre hooks, so that if some
 *  suman.pre hooks fail, the post hooks still run
 *
 *  data param {}
 *
 */




module.exports = data => {



    return {

        // this configuration specifies that if the suman-pre-example hook completes,
        // then the suman-post-hook needs to run

        'suman-pre-hook (example)': ['suman-post-hook-1 (example)','suman-post-hook-2 (example)'],




    }





};