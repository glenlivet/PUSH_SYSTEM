
 var util = require("util");
 var events = require("events");
 //messageID最大值
 var _max = 65535;
 
 /**
  * MidFactory Constructor
  * Message ID 工厂
  *
  * @property <Array> recycled --an array of recycled mid 回收可再利用message ID
  * @property <Number> available --the next available number beside the recycleds 可用的messageID
  */
var MidFactory = module.exports= 
function MidFactory(){
	this.recycled = [];
	this.available = 1;
	events.EventEmitter.call(this);
}
//inherits EventEmitter
util.inherits(MidFactory, events.EventEmitter);
/**
 * createdMid 创建一个可用messageID
 * use the recycled mid first 先用回收的。
 * emit when mid is overflow.当用到65536时，溢出，抛出溢出事件
 */
MidFactory.prototype.createMid = 
function(){
	if(this.recycled.length>0)
		return this.recycled.shift();
	if(this.available < _max)
		return this.available++;
	this.emit('mid_overflow');
	return -1;
}

/**
 * recycle recycle the mission-accomplished mid 回收完成推送的message id
 * mid	<Number> the mid w8ing for recycle.
 */
MidFactory.prototype.recycle =
function(mid){
	this.recycled.push(mid);
}

//reset the factory 
MidFactory.prototype.reset = 
function(){
	this.recycled = [];
	this.available = 1;
}


