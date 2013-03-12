/**
 * New node file
 */
 var util = require("util");
 var events = require("events");
 
 /**
  * CachedMsg Constructor
  * Message缓存对象构造体 
  * 
  * @param obj <Object> 
  */
 var CachedMsg = module.exports = 
 function CachedMsg(obj){
 	var obj = obj||{};
 	//当前的mid
 	this.curMid = obj.curMid;
 	//主题
 	this.topic  = obj.topic;
 	//内容
 	this.payload = obj.payload;
 	//收件人（用clientId和qos形成的对象表示）
 	//eg. publishRecipients[glenn] = 0 表示接收者glenn qos等级0
 	this.publishRecipients = obj.publishRecipients||{};
	
 	this.pubrelRecipients = obj.pubrelRecipients||[];
 	//发送人(clientId)
 	this.sender = obj.sender;
 	//发送时间
 	this.createdTime = obj.createdTime||new Date();
 	//初始mid
 	this.initMid = obj.initMid;
 	
 	events.EventEmitter.call(this);
 }
 
 //继承EventEmitter
 util.inherits(CachedMsg, events.EventEmitter);
 
 /**
  * addPublishRecipients 添加一个publish的收件人
  *
  * @param <String> clientId
  * @param <Number> qos
  */
 CachedMsg.prototype.addPublishRecipient = 
 function(clientId, qos){
 	this.publishRecipients[clientId] = qos;
 }
 /**
  * removePublishRecipient 删除一个publish的收件人
  *
  * @param <String> clientId
  */
 CachedMsg.prototype.removePublishRecipient = 
 function(clientId){
 	delete this.publishRecipients[clientId];
 	if(this.pubrelRecipients.length == 0 && isEmptyObject(this.publishRecipients))
 		this.emit('done');
 }
 /**
  * @deprecated 不应该直接调用这个方法来添加pubrel收件人，应用publishToPubrel
  * addPubrelRecipient 添加一个pubrel的收件人 （qos为2时，publish收件人转为pubrel收件人）
  *
  * @param <String> clientId
  * @see CashedMsg#publishToPubrel
  */
 CachedMsg.prototype.addPubrelRecipient = 
 function(clientId){
 	this.pubrelRecipients.push(clientId);
 }
 
 /**
  * removePubrelRecipient 删除pubrel收件人（当收到pubcomp时）同时检查信息是否全部发送完毕
  *
  * @param <String> clientId
  */
 CachedMsg.prototype.removePubrelRecipient = function(clientId){
 	var all = this.pubrelRecipients;
 	var index = all.indexOf(clientId);
 	if(index>=0){
 		//从array中删除该clientId
 		this.pubrelRecipients.splice(index,1);
 		//检测是否所有的发件人都已经发完，如果是，则发出'done'事件
 		if(this.pubrelRecipients.length == 0 && isEmptyObject(this.publishRecipients))
 			this.emit('done');
 	}
 }
 
 /**
  * publishToPubrel qos2的信息收到pubrec后，将收件人从publish中删除，加到pubrel中
  *
  * @param <String> clientId
  */
 CachedMsg.prototype.publishToPubrel = function(clientId){
 	delete this.publishRecipients[clientId];
 	this.pubrelRecipients.push(clientId);
 }
 
 
 
 //判断是否为空对象
 function isEmptyObject(obj){
 	for(var k in obj){
 		return false;
 	}
 	return true;
 }
 
 
 