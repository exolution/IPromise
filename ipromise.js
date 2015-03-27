/**
 * A link-style promise Implementation
 */
var _Slice = Array.prototype.slice;

var _safeWriteFlag = false;
var STATE = 1, VALUE = 2;
window.IPromise = function(func) {
    return new Promise(func);
};
function all(){
    var p=new Promise(),count=arguments.length,data=[];
    function sandGlass(v){
        count--;
        data[this.idx]=v;
        if(count==0){
            p.resolve(data);
        }
    }
    for(var i=0;i<arguments.length;i++){
        var pro=arguments[i];
        if(pro instanceof Promise){
            pro.idx=i;
            pro.then(sandGlass);
        }
        else{
            data[i]=pro;
            count--;
        }
    }
    return p;
}
function race(){
    var p=new Promise();
    function sandGlass(v){
        p.resolve(v);
    }
    for(var i=0;i<arguments.length;i++){
        var pro=arguments[i];
        if(pro instanceof Promise){
            pro.then(sandGlass);
        }
    }
    return p;
}
function Promise() {
    var state = 'pending', value = null;
    this.get = function(prop) {
        if(prop === STATE) {
            return state;
        }
        else if(prop === VALUE) {
            return value;
        }

    };
    this.set = function(prop, v) {
        if(_safeWriteFlag) {
            if(prop === STATE) {
                state = value;
            }
            else if(prop === VALUE) {
                value = v;
            }
        }
    };
    this.onFulfilledQueue = [];//Promise/A+ 2.2.6对于同一个promise then可能会调用多次 因此需要一个回调列表
    this.onRejectedQueue = [];
    this.onProgressList = [];
    this.params = {};
}

Promise.prototype = {

    then    : function(onFulfilled, onRejected, onProgress) {

        var next = new Promise();
        if(typeof onFulfilled === 'function') {//Promise/A+ 2.2.1 非函数的参数将被忽略
            this.onFulfilledQueue.push({next : next, onFulfilled : onFulfilled});
        }
        if(typeof onRejected === 'function') {
            this.onRejectedQueue.push({next : next, onRejected : onRejected});
        }
        if(typeof onProgress === 'function') {
            //此处为附加的功能 规范中并未规定 指onFulfilled执行前所触发的回调
            this.onProgressList.push(onProgress);
        }
        this.next = next;
        if(this.get(STATE) == 'fulfilled') {
            this.resolve.call(this, this.get(VALUE));
        }
        if(this.get(STATE) == 'rejected') {
            this.reject.call(this, this.get(VALUE));
        }
        return next;
    },
    resolve : function(value) {
        if(this.get(STATE)=='pending') {
            _resolve(this,value);
        }

    },
    reject  : function(value) {
        if(this.get(STATE)=='pending') {
            _onStateChange(this, 'rejected', value);
        }
    },
    catch:function(onRejected){
        return this.then(null,onRejected);
    },
    finally:function(onFinally){
        this.onFinally=onFinally;
    }
};
Promise.race=race;
Promise.all=all;
function _resolve(promise,value){
    if(value instanceof Promise) {
        value.then(function promiseResolve(v) {
            promise.resolve(v);
        }, function promiseReject(r) {
            promise.reject(r);
        });

    }
    else {
        _onStateChange(promise, 'fulfilled', value);
    }
    value=null;
}
function _onStateChange(promise, state, value) {
    _safeWriteFlag = true;
    promise.set(STATE, state);
    promise.set(VALUE, value);
    _safeWriteFlag = false;
    var queue;
    if(state === 'fulfilled') {
        if(promise.onFulfilledQueue.length > 0) {
            while(queue = promise.onFulfilledQueue.shift()) {
                try {
                    var ret = queue.onFulfilled.call(promise,value);
                    queue.next.resolve(ret);
                } catch(exception) {
                    console.error(exception);
                    console.log(exception.stack);
                    queue.next.reject(exception);
                }

            }
        } else {
            promise.next && promise.next.resolve.call(promise,value);
        }
    }
    else if(state === 'rejected') {
        if(promise.onRejectedQueue.length > 0) {
            while(queue = promise.onRejectedQueue.shift()) {
                try {
                    ret = queue.onRejected.call(promise,value);
                    if(ret === undefined) {//继续异常冒泡
                        queue.next.reject(value);
                    }
                    else if(ret !== 'false') {//异常恢复
                        queue.next.resolve(ret)
                    }
                    //else if(ret===false) //停止异常冒泡
                } catch(exception) {
                    console.error(exception);
                    queue.next.reject(exception);
                }

            }
        } else {
            promise.next && promise.next.reject.call(promise,value);
        }
    }
    promise.onFinally&&promise.onFinally.call(promise,value)
}
