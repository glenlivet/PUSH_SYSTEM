/**
 * New node file
 */
 //TODO: getCachedMsg() leaving to be finished
 //TODO: 没有做retain          ?????????????//TESTING
 //TODO: client.on('unsubscribe') ??????//TESTING
 //TODO: dup						????????//TESTING
 //TODO: 
 //TODO: NO PUBLISHEE		?????????????//TESTING
 //TODO: 重复订阅				???????//testing
 
 
var mqtt = require('../..')
  , NodeLog = require('../log/node_log.js')
  , Subscription = require('./Subscription.js')
  , MicFactory = require('./mid_factory.js')
  , CachedMsg = require('./msg_factory.js')
  , RetainMsgFac = require('./retain_msg.js')
  , util = require('util');
  //所有客户端connection的集合
  //这里的client是一个连接到该client的connection对象
  //｛
  //	id : //客户端id，
  //	subscriptions: //订阅数组，参见@Subscription
  // }
  var clients = {};
  var cachedMsgs = [];
  //类型 { topic : msg} 
  var retainMsgs = {};
  var _micFac = new MicFactory();
  var _nodeLog = new NodeLog(true);
  
  //var _msgFac = new MsgFactory();
  //var _doLog = true;
  
mqtt.createServer(function(client) {
  
  //每当有新的客户端连接到服务器
  client.on('connect', function(packet) {
  //log
  	_nodeLog.info('Client[clientId=' + packet.clientId + '] has sent a connect');
  	//检查username和password是否对
  	//will msg handle
  	//检查是否是新客户端
  	if(!clients[packet.clientId]){
  		//是新的客户端
  		//将客户端加入集合，并初始化id和订阅主题,发布的信息集合
    	client.id = packet.clientId;
    	client.subscriptions = [];
    	clients[packet.clientId] = client;
    }else
    {
    	
    	//更新老客户的socket
    	clients[packet.clientId].stream = client.stream;
    	clients[packet.clientId].server = client.server;
    	client = clients[packet.clientId];
    	//发送缓存msg
    	sendCachedMsgTo(packet.clientId);
    }
    	//来着不拒
    client.connack({returnCode: 0});
    //log
    _nodeLog.info('Client[clientId=' + client.id + '] has just connected in.');
    _nodeLog.info('His subscription: ' + util.inspect(client.subscriptions, true, null));
  });
	//客户订阅主题（将订阅主题纪录下来）
	//暂时是一订阅就给该用户发retain信息
	//更合理的应该是等suback之后再发
  client.on('subscribe', function(packet) {
  	//log
  	_nodeLog.info('Client[clientId=' + client.id + '] has sent a SUBSCRIBE');
    var granted = [];
    //retains
    var retainsMet = {};
    //var _subs = [];       //TESTING redundant 13032013

    for (var i = 0; i < packet.subscriptions.length; i++) {
    	//订阅的请求qos
      var _qos = packet.subscriptions[i].qos
      	//订阅的主题
        , _topic = packet.subscriptions[i].topic;
        var _sub = null;
        //检查客户是否已订阅过 如果是 检查订阅等级是否变化？
        var hasSubed = false;
        for(var j=0;j<client.subscriptions.length;j++){
        	if(client.subscriptions[j].topicDesc === _topic){
        		//dumplicated subscription
        		//check qos
        		client.subscriptions[j].qos = _qos;
        		hasSubed = true;
        		break;
        	}
        }
        //如果已经订阅过 则跳到下一个订阅物继续订阅
        if(hasSubed){
        	granted.push(_qos);
        	continue;
        }
        //是否为wildcard订阅
        if(_topic.indexOf('+')>=0||_topic.indexOf('#')>=0){
        	//是，用正则表达式
       		var _reg = new RegExp('^' + _topic.replace('+', '[^\/]+').replace('/#', '(/.+)?$'));
			//新建一个Subscription对象
			_sub = new Subscription({topic: _reg, abs: false, qos: _qos, topicDesc: _topic});
      		client.subscriptions.push(_sub);
      		handleRetainPublish(client, _reg, _qos);
      		
      	}else{
      		//不是
      		_sub = new Subscription({topic: _topic, abs: true, qos: _qos, topicDesc: _topic});
      		client.subscriptions.push(_sub);
      		//handle retains
      		handleRetainPublish(client, _topic, _qos);
      		
      	}
      	//将认可的订阅qos加入到返回数组
      	granted.push(_qos);
      	//_subs.push(_sub);			//TESTING redundant 13032013
      	
    }
	//SUBACK
    client.suback({messageId: packet.messageId, granted: granted});
    //log
    _nodeLog.info('Client[clientId=' + client.id + '] just subscribed 1 subscription');
    _nodeLog.info('His subscription: ' + util.inspect(client.subscriptions, true, null));
  });
  //取消订阅
  client.on('unsubscribe', function(packet){
  	//log
  	_nodeLog.info('Client[clientId=' + client.id + '] has sent a UNSUBSCRIBE');
  	//loop through client's subscriptions ,find and delete it from the array
  	var _subs = client.subscriptions;
  	//_nodeLog.debug(util.inspect(packet.unsubscriptions, true, null));
  	//_nodeLog.debug(util.inspect(_subs, true, null));
  	//loop unsubs, each one do delete
  	for(var i=0; i<packet.unsubscriptions.length;i++){
  		//the topic of unsub
  		var _topic = packet.unsubscriptions[i];
  		for(var j=0;j<_subs.length;j++){
  			if(_subs[j].topicDesc == _topic){
  				_subs.splice(j,1);
  				//log
  				_nodeLog.warn('Topic: ' + _topic + ' has been dumped by Client[clientId=' + client.id + ']');
  				break;
  			}
  		}
  	}
  	_nodeLog.info('Client[clientId=' + client.id + ']\'s subscriptions now are ' + util.inspect(client.subscriptions, true, null));
  	//send back unsuback
  	client.unsuback({messageId: packet.messageId});
  	//log
  	_nodeLog.info('UNSUBACK has been sent back to Client[clientId=' + client.id + ']');
  	
  });
	//客户发布： 
  client.on('publish', function(packet) {
  	//log
  	_nodeLog.info('Client[clientId=' + client.id + '] has sent a PUBLISH');
  	
  	//handle Retain
  	if(packet.retain == true){
  		var _topic = packet.topic;
  		_nodeLog.debug('Received a RETAIN MSG on [TOPIC:' + _topic + '].');
  		//handle delete retain msg (which got a null payload)
  		if('undefined' == typeof packet.payload || null == packet.payload || '' == packet.payload){
  			_nodeLog.info('A DEL-RETAIN-COMMAND MSG on [TOPIC: ' + _topic + '] has received!');
  			for(var __topic in retainMsgs){
  				if(_topic === __topic){
  					delete retainMsgs[__topic];
  					_nodeLog.info('Retain Msg on [TOPIC:' + _topic + '] has been deleted!');
  					break;
  				}
  			}
  		}
  		//otherwise add/renew the retain msg
  		var _retainMsg = new RetainMsgFac.retainMsg(packet.payload, packet.qos);
  		retainMsgs[_topic] = _retainMsg;
  		_nodeLog.info('[RETAIN MSG] [TOPIC: ' + _topic + '] [PAYLOAD: ' + packet.payload + '] [QOS: ' + packet.qos +
  						'] has been added/renewed in retainMsgs collection');
  		
  	}
  	
  	var targets = getSubscribedClients(packet.topic);
  	//test if got no subscribedClients
  	var noTarget = false;
  	if(isEmptyObject(targets)) {
  		noTarget = true;
  		_nodeLog.info('PUBLISH: ' + util.inspect(packet, true, null) + ' got no subscriber!');
  	}
  	switch(packet.qos){
  		case 0:
  		//qos 0: 直接发送
  			for(var clientId in targets){
  				var _toClient = clients[clientId];
  				_toClient.publish({topic: packet.topic, payload: packet.payload, qos: 0});
  				//log
  				_nodeLog.info('message: ' + '[topic] ' +  packet.topic + ' [payload]' + packet.payload + ' [qos]0 ' + 
  								' has just been sent to Client[clientId=' + clientId + ']');
  			}
  			break;
  		case 1:
  		//qos 1: generate new mid for further publishing; store the msg; publish it; send PUBACK back;
  			if(!noTarget){
  			//更改发送目标的qos
  			for(var clientId in targets){
  				targets[clientId] = targets[clientId] > 1 ? 1 : targets[clientId];
  			}
  			//store msg
  			var _curMid = _micFac.createMid();
  			var _msg = new CachedMsg({
  				curMid  		  : _curMid,
  				topic   		  : packet.topic,
  				payload 		  : packet.payload,
  				publishRecipients : targets,
  				sender			  : client.id,
  				initMid			  : packet.messageId 
  			});
  			addCachedMsg(_msg);
  			//publish 
  			for(var clientId in targets){
  				var _toClient = clients[clientId];
  				var _pubQos   = targets[clientId];
  				_toClient.publish({topic    : _msg.topic, 
  								   payload  : _msg.payload,
  								   qos      : _pubQos,
  								   messageId: _msg.curMid});
  				//log
  				_nodeLog.info('message: ' + '[topic] '  +  _msg.topic + 
  								   ' [payload] '  +  _msg.payload + 
  								   ' [qos] '      +  _pubQos + 
  								   ' [messageId] ' +  _msg.curMid + 
  								' has just been sent to Client[clientId=' + clientId + ']');
  				//if(_pubQos == 0) 将发送者从发送列表中删除 
  				if(_pubQos == 0){
  					_msg.removePublishRecipient(clientId);
  					//log
  					_nodeLog.info('msg[msgId=' + _msg.curMid + '] has removed recipient[ClientId=' + clientId + 
  									'] for QOS\' sake');
  				}
  				//备注：if _pubQos == 1 在PUBACK中删除
  				//备注： if _pubQos == 2 在PUBREC中做publishToPubrel
  			}
  			//delete the initMid
  			_msg.initMid = null;
  			}
  			//PUBACK 
  			client.puback({messageId: packet.messageId});
  			//log
  			_nodeLog.info('msg[msgId=' + packet.messageId + '] has been sent a PUBACK back to Client[clientId=' + client.id + ']');
  			break;
  		case 2:
  			//qos 2: 
  			var hasCached = false;
  			//handle DUP
  			if(packet.dup == true){
  				//loop cachedMsgs see if the dup one can be found
  				for(var m=0;m<cachedMsgs.length;m++){
  					//find if has cached b4
  					if(client.id === cachedMsgs[m].sender && packet.messageId === cachedMsgs[m].initMid){
  						_nodeLog.warn('a dup publish has been caught. ' + 
  								'probably caused by previous disconnection with Client[clientId=' + 
  								 client.id + ']. The msg: ' + packet);
  						hasCached = true;
  						break;
  					}
  				}
  			}
  			if(!hasCached){
  				//generate new mid for further publishing
  				var _curMid = _micFac.createMid();
  				//store the msg
  				var _msg = new CachedMsg({
  					curMid  		  : _curMid,
  					topic   		  : packet.topic,
  					payload 		  : packet.payload,
  					publishRecipients : targets,
  					sender			  : client.id,
  					initMid			  : packet.messageId 
				});
  				//log
 				_nodeLog.info('msg: ' + 
  							util.inspect(_msg, true, null) + 'has been cached.');
  				//add to CachedMsgs
  				addCachedMsg(_msg);	
  			}
  			
  			
  			//PUBREC
  			client.pubrec({messageId: packet.messageId});		
  			//log
  			_nodeLog.info('PUBREC on msg[msgId=' + packet.messageId + 
  							'] has been sent back to Client[clientId='+ client.id+']');
  			break;
  		default:
  			break;
  	} 
  });
  
  //当接收到PUBREL时
  //qos2:  Publish Message To Subscribers, delete message ID, send PUBCOMP back
  client.on('pubrel', function(packet){
  	//log
  	_nodeLog.info('Client[clientId=' + client.id + '] has sent a PUBREL');
  	//find the cached msg
  	var __initMid = packet.messageId;
  	var __sender  = client.id;
  	var _msg = null;
  	//循环缓存msg找到初始msgId一样的msg
  	for(var i = 0; i < cachedMsgs.length; i++){
  		if(__initMid === cachedMsgs[i].initMid && __sender === cachedMsgs[i].sender){
  			_msg = cachedMsgs[i];
  			break;
  		}
  	}
  	//没找到匹配的缓存msg //这里保证了程序只处理一次publish
  	if(_msg == null) {
  		//log
  		_nodeLog.info('Unknown msg id detected! May caused by DUP! ');
  		if(packet.dup == true){
  			this.pubcomp({messageId: packet.messageId, dup: 1});
  			return;
  		}else{
  			this.emit('error', new Error('Unknown message id'));
  		}
  	}
  	
  	//publish to subscribers
  	var targets = _msg.publishRecipients;
  	if(isEmptyObject(targets)){
  		_nodeLog.warn('IN PUBREL, THIS PUBLISHED MSG GOT NO PUBLISHRECIPIENT!AND THE MID SHOULD BE RECYCLED SOON');
  		_msg.emit('done');
  	}else{
  	
  		//循环每一个订阅者
  		for(var clientId in targets){
  			//订阅者连接
  			var _tar = clients[clientId];
  			//订阅qos
  			var _qos = targets[clientId];
  			_tar.publish({
  				topic    : _msg.topic, 
  				payload  : _msg.payload,
  				qos      : _qos,
  				messageId: _msg.curMid
  			});
  			//log
  			_nodeLog.info('msg: ' + 
  					' [topic] '    + _msg.topic + 
  					' [payload] '  + _msg.payload +
  					' [qos] '  +  _qos +
  					' [messageId] ' +  _msg.curMid +
  			 	 	' has been published to ' + 'Client[clientId=' + clientId + ']');
  			//从publish列表中删除所有qos==0的订阅者
  			if(_qos == 0){
  				_msg.removePublishRecipient(clientId);
  				//log
  				_nodeLog.info('Client[clientId=' + clientId + 
  							'] has been removed from msg[msgId=' + _msg.curMid + '] \'s PUBLISH recipients');
  			}
  			//qos==1在puback中删除
  			//qos==2在pubrec中做publicToPubrel
  		}
    	//delete the initial msgId
    	_msg.initMid = null;
    }
    //send PUBCOMP
    this.pubcomp({messageId: __initMid});
    //log
    _nodeLog.info('PUBCOMP on msg[msgId=' + __initMid + '] has been sent back to Client[clientId=' + client.id + ']');
  	
  });
  //handle PUBACK
  client.on('puback', function(packet){
  	//log
  	_nodeLog.info('Client[clientId=' + client.id + '] has sent a puback');
  	//找到cachedMsg
  	var _msgId = packet.messageId;
  	var _msg = null;
  	for(var i=0;i<cachedMsgs.length;i++){
  		if(_msgId === cachedMsgs[i].curMid){
  			_msg = cachedMsgs[i];
  			break;
  		}
  	}
  	if(_msg == null) this.emit('error', new Error('Unknown message id'));
  	//delete the client from pubrelrecipients
  	_msg.removePublishRecipient(client.id);
  	//log
  	_nodeLog.info('Client[clientId=' + client.id + '] has been removed from msg[msgId=' + _msgId + '] \'s PUBLISH LIST');
  		
  });
  
  //当接收到pubrec
  client.on('pubrec', function(packet){
  	//log
  	_nodeLog.info('Client[clientId=' + client.id + '] has sent a pubrec');
  	//通过msgId找到_msg
  	var _msgId = packet.messageId;
  	var _msg = null;
  	for(var i=0;i<cachedMsgs.length;i++){
  		if(_msgId === cachedMsgs[i].curMid){
  			_msg = cachedMsgs[i];
  			break;
  		}
  	}
  	if(_msg == null) {
  		this.emit('error', new Error('Unknown message id'));
  		
  	}
  	//缓存中将收件人从publish转为pubrel
  	var _clientId = client.id;
  	_msg.publishToPubrel(_clientId);
  	//log
  	_nodeLog.info('Client[clientId=' + _clientId + '] has been moved from PUBLISH LIST to PUBREL LIST on cachedmsg[msgId=' + _msgId + ']');
  	//do pubrel
  	client.pubrel(packet);
  	//log
  	_nodeLog.info('PUBREL on msg[msgId=' + _msgId + '] has been sent back to Client[clientId=' + client.id + ']');
  });
  
  //当接收到pubcomp
  client.on('pubcomp', function(packet){
  	//log
  	_nodeLog.info('Client[clientId=' + client.id + '] has sent a pubcomp');
  	//找到cachedMsg
  	var _msgId = packet.messageId;
  	var _msg = null;
  	for(var i=0;i<cachedMsgs.length;i++){
  		if(_msgId === cachedMsgs[i].curMid){
  			_msg = cachedMsgs[i];
  			break;
  		}
  	}
  	if(_msg == null) client.emit('error', new Error('Unknown message id'));
  	//delete the client from pubrelrecipients
  	_msg.removePubrelRecipient(client.id);
  	//log
  	_nodeLog.info('Client[clientId=' + client.id + '] has been removed from msg[msgId=' + _msgId + '] \'s PUBREL LIST');
  	var n = 0;
  	for(var k in _msg.publicRecipients) n++;
  	_nodeLog.info('clients w8ing for pubrel: '+ _msg.pubrelRecipients.length + ' for publish' + n);
  		
  });

  client.on('pingreq', function(packet) {
    client.pingresp();
  });

  client.on('disconnect', function(packet) {
  	//log
  	_nodeLog.warn('Client[clientId=' + client.id + '] has disconnected');
    client.stream.end();
  });

  client.on('close', function(packet) {
    //log
  	_nodeLog.info('Client[clientId=' + client.id + '] has closed the connection');
  });

  client.on('error', function(e) {
    client.stream.end();
    _nodeLog.err(e);
  });
}).listen(process.argv[2] || 1883);


//TODO: 
/**
 * getCachedMsg 获取缓存中的msg
 *
 * @param msgId <Number> the message Id return from the packet
 * @param initial <Boolean> if the messageId is an initial one or not
 * @param sender <String> the clientId of the sender
 *
 * @return _msg <CachedMsg> the cached msg
 * @throw 'Unknown msg id err' <Error> when the messageId is not matched in cached msgs array.
 * @see CachedMsg
 */
function getCachedMsg(msgId, initial, sender){
	//循环缓存msg找到初始msgId一样的msg
  	for(var i = 0; i < cachedMsgs.length; i++){
  		if(__initMid === cachedMsgs[i].initMid && __sender === cachedMsgs[i].sender){
  			_msg = cachedMsgs[i];
  			break;
  		}
  	}
  	//没找到匹配的缓存msg //这里保证了程序只处理一次publish
  	if(_msg == null) this.emit('error', new Error('Unknown message id'));
}

/**
 * addCachedMsg 向缓存消息数组中添加一个msg
 *
 * @param msg <CachedMsg> 待添加的msg
 *
 * @see CachedMsg
 */
 function addCachedMsg(_msg){
 	//监听_msg.emit('done') ，把msg从列表中删除，回收这个curMid
  	_msg.once('done', function(){
  		var __mid = this.curMid;
  		//把msg从列表中删除
  		for(var i=0;i<cachedMsgs.length;i++){
  			if(__mid === cachedMsgs[i].curMid){
				cachedMsgs.splice(i,1);
				break;
			}
  		}
  		//recycle the curMid
  		_micFac.recycle(__mid);
  		//log
  		_nodeLog.info('msg[msgId=' + __mid + '] has done, mid has been recycled');
  	});
  	cachedMsgs.push(_msg);	
 }
 
 /**
  * sendCachedMsgTo 注册过的客户端重新连接后，将属于其的msg发送给他，包括(publish和pubrel)
  * 
  * @param clientId <String> 
  */
  function sendCachedMsgTo(clientId){
  	//loop the cached msg array
  	for(var i=0;i<cachedMsgs.length;i++){
  		var _msg = cachedMsgs[i];
  		//clientId in publishRecipients 
  		if(clientId in _msg.publishRecipients){
  			//publish
  			clients[clientId].publish({
  				topic		: _msg.topic,
  				payload		: _msg.payload,
  				messageId	: _msg.curMid,
  				qos			: _msg.publishRecipients[clientId],
  				dup			: true
  			});
  			//log
  			_nodeLog.info('a msg has been republish to Client[clientId=' + clientId + '] on qos' + _msg.publishRecipients[clientId]);
  			continue;
  		}
  		
  		//clientId in pubrelRecipients
  		var _pubrelRecipients = _msg.pubrelRecipients;
  		//在该msg的pubrel收件人中寻找clientId,如果找到， 发送pubrel，并跳出循环
  		for(var j=0;j<_pubrelRecipients.length;j++){
  			if(clientId === _pubrelRecipients[j]){
  				clients[clientId].pubrel({messageId : _msg.curMid, dup: true});
  				break;
  			}
  		}
  	}
  }

/**
 * getSubscribedClients 通过发送主题找到订阅的客户以及订阅的qos
 * 
 * @param _topic <String> 发送的主题
 * @return rtn <Array> 一个包含订阅客户和qos的数组
 */
function getSubscribedClients(_topic){
	//return obj {clientId : subQos}
	var rtn = {};
	//每一个客户端
	for (var clientId in clients) {
      	var c = clients[clientId];
      	//每一个客户端的每一个订阅和现在待发送的主题进行比对
      	for(var i = 0; i < c.subscriptions.length; i++){
      		var _sub = c.subscriptions[i];
      		if(_sub.abs === true && _sub.topic === _topic){
      			//rtn.push({toClient: c, subQos: _sub.qos});
      			rtn[clientId] = _sub.qos;
      			break;
      		}else
      		if(_sub.abs === false && _sub.topic.test(_topic)){
      			//rtn.push({toClient: c, subQos: _sub.qos});
      			rtn[clientId] = _sub.qos;
      			break;
      		}
      	} 			
  	}
  	var n = 0;
  	for(var k in rtn){
  		n++;
  	}
  	//_nodeLog.debug('TOPIC: ' + _topic + ' got ' + n + ' subscriber(s).');
  	return rtn;
}

 function handleRetainPublish(client, _topic, _qos){
 	for(var _retainTopic in retainMsgs){
    	if('object' === typeof _topic ? _topic.test(_retainTopic) : _topic === _retainTopic){
    		_nodeLog.debug('[RETAIN PUBLISH] find a match on [TOPIC: ' + _topic + '].');
      		//publish
      		var _modQos = retainMsgs[_retainTopic].arrangeQos(_qos);
      		_nodeLog.debug('[RETAIN PUBLISH] sent by [QOS: ' + _modQos + '].');
      		switch(_modQos){
      			case 0:
      				client.publish({
      								topic		: _retainTopic, 
      								payload		: retainMsgs[_retainTopic].payload,
      								qos			: 0});
      				_nodeLog.info('[RETAIN MSG]: ' + '[topic] ' +  _retainTopic + ' [payload]' + retainMsgs[_retainTopic].payload + ' [qos]0 ' + 
  								' has just been published to Client[clientId=' + client.id + ']');
  					break;
      			case 1:
      			case 2:
      				//createMid;
      				var _mid = _micFac.createMid(); 
      				var _targets ={};
      				_targets[client.id] = _modQos;
      				//construct a cachedMsg; 
      				var _cachedMsg = new CachedMsg({
      					curMid  		  : _mid,
  						topic   		  : _retainTopic,
  						payload 		  : retainMsgs[_retainTopic].payload,
  						publishRecipients : _targets
      				});
      				//add to cachedMsgs; 
      				addCachedMsg(_cachedMsg);
      				//publish
      				client.publish({
      					topic		: _retainTopic,
      					payload 	: retainMsgs[_retainTopic].payload,
      					messageId	: _mid,
      					qos			: _modQos,
      					retain		: true
      				});
      				//log
      				_nodeLog.info('[RETAIN MSG]: ' + '[topic] '  +  _retainTopic + 
  								   ' [payload] '  +  retainMsgs[_retainTopic].payload + 
  								   ' [qos] '      +  _modQos + 
  								   ' [messageId] ' +  _mid + 
  								   ' has just been sent to Client[clientId=' + client.id + ']');
  					break;
  				default:
  					//ERROR
  					client.emit('error', new Error('[SYSTEM ERR]Wrong QOS detected when publish a retain msg to Client[clientId=' + 
  								client.id + '].'));
  					break;
      		}
      		
      		
      	}
    }
 
 }

//判断是否为空对象
 function isEmptyObject(obj){
 	for(var k in obj){
 		return false;
 	}
 	return true;
 }