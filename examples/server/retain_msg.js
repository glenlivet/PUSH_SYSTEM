/**
 * New node file
 */

 
 var Retain_msg = exports.retainMsg = 
 function(payload, qos){
 	this.payload = payload;
 	this.qos	 = qos;
 }
 
 Retain_msg.prototype.arrangeQos = 
 function(_qos){
 	if(this.qos > _qos){
 		return _qos;
 	}
 	return this.qos;
 }
 
 