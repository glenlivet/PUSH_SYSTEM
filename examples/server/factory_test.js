/**
 * New node file
 */
var Fac = require('./mid_factory');

var myFac = new Fac();

console.log('the 1st ID: ' + myFac.createMid());
console.log('the 2nd ID: ' + myFac.createMid());
console.log('recycle mid:1');
myFac.recycle(1);
console.log('the 3rd ID: ' + myFac.createMid());
console.log('the 4th ID: ' + myFac.createMid());