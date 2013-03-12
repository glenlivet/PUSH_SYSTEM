/**
 * New node file
 */

 var _isLog = true;

 var colors = require('./colors');
 var patt = /[0-9]+\s?[A-z]{3}\s?[0-9]{4}\s[0-9]{2}:[0-9]{2}:[0-9]{2}/
 
 colors.setTheme({
 	info: 'green',
 	warn: 'yellow',
 	debug: 'blue',
 	error: 'red'
 });

 var NodeLog = module.exports = 
 function NodeLog(isLog){
 	_isLog = isLog;
 }
 
 NodeLog.prototype.info = 
 function(log){
 	if(_isLog){
 		console.log(('[INF@'+getCurTime()+']: ' + log).info);
 	}
 }
 
 NodeLog.prototype.warn = 
 function(log){
 	if(_isLog){
 		console.log(('[WRN@'+getCurTime()+']: ' + log).warn);
 	}
 }
 
 NodeLog.prototype.debug = 
 function(log){
 	if(_isLog){
 		console.log(('[DBG@'+getCurTime()+']: ' + log).debug);
 	}
 }
 
 NodeLog.prototype.err = 
 function(log){
 	if(_isLog){
 		console.log(('[ERR@'+getCurTime()+']: ' + log).error);
 	}
 }
 
 function getCurTime(){
 	var date = new Date();
 	var timeStr = date.toUTCString();
 	var patt_date = /[0-9]+\s?[A-z]{3}\s?[0-9]{4}/;
	var patt_time = /[0-9]{2}:[0-9]{2}:[0-9]{2}/;
	var str_date = patt_date.exec(timeStr).toString().replace(/\s/g, '');
	var str_time = patt_time.exec(timeStr).toString().replace(/:/g, '');
	return str_date+'/'+ str_time;
 }
 /*
 console.log('this is a error'.error);
 console.log('this is a info'.info);
 console.log('this is a debug'.debug);
 console.log('this is a warn'.warn);
 */