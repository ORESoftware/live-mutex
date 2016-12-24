/**
 * Created by Olegzandr on 6/25/16.
 */


try {
	console.log('suman-utils:', require.resolve('suman-utils'));
	console.log('suman-server:', require.resolve('suman-server'));
}
catch(e){
	console.log(e.stack);
}
