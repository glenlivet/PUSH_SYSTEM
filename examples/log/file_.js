/**
 * New node file
 */
 var fs = require('fs');
 
 var template = fs.readFileSync('./template.html');
 var templateBuf = new Buffer(template);
 var templateLen = templateBuf.length;
 
 var _tail = new Buffer('</body>\n</html>');
 var tailLen = _tail.length;
 
 var start_pos = templateLen - tailLen;
 	 
 
 
 fs.open('/Users/Glenlivet/Documents/temp/test.html', 'w+', 0666, function(err, fd){
 	fs.writeSync(fd, template, 0, templateLen,0);
 	
 	var _log = new Buffer('LOG INFO: ' + new Date() + 'System works stably!<br>\n</body>\n</html>');
 	fs.writeSync(fd, _log, 0, _log.length, templateLen - tailLen);
 
 });
 
 
 
 