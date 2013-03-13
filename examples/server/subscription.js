/**
 * New node file
 */

 
 var Subscription = module.exports =
 function Subscription(obj){
 	this.topic = obj.topic;
 	this.qos   = obj.qos||0;
 	this.abs  = obj.abs;
 	this.topicDesc = obj.topicDesc;
 }
 
 Subscription.prototype.modifyQos = 
 function(qos){
 	this.qos = qos;
 }