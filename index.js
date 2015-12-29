/**
 * A link-style promise Implementation
 */

var _safeWriteFlag = false;
var STATE = 1, VALUE = 2;
var _uuid = 0;

function Promise() {
    if(!(this instanceof Promise)) return new Promise();
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
                state = v;
            }
            else if(prop === VALUE) {
                value = v;
            }
        }
    };

    // for heapdump
    //this.xxx=eval('(function a'+_uuid+'(){})');
    //console.log(_uuid+'\n'+new Error().stack);
    this.uuid = _uuid++;
    //safemode是指 永远不会有未捕获的异常 即使reject时 onRejected执行发生异常 也会被捕获并reject next promise
    //catch方法的第二个参数可以关闭 safemode 关闭后 可在 reject里抛出异常 扔给系统 （不推荐这么做）
    this.safeMode = true;
    //Promise/A+ 2.2.6对于同一个promise then可能会调用多次 因此需要一个回调列表
    this.onFulfilledQueue = [];
    this.onRejectedQueue = [];
}
Promise.prototype = {
    linkTo  : function(promise) {
        if(promise instanceof Promise) {
            this.then(function(v) {
                promise.resolve(v);
            }, function(r) {
                promise.reject(r);
            });
        }
        return promise;
    },
    then    : function then(onFulfilled, onRejected, onProgress) {
        var next = new Promise();

        if(typeof onFulfilled === 'function') {//Promise/A+ 2.2.1 非函数的参数将被忽略
            this.onFulfilledQueue.push({next : next, onFulfilled : onFulfilled});
        }
        if(typeof onRejected === 'function') {
            this.onRejectedQueue.push({next : next, onRejected : onRejected});
        }
        this.next = next;
        if(this.get(STATE) === 'fulfilled') {
            var self = this;
            process.nextTick(function() {
                _resolve(self, self.get(VALUE));
            });

        }
        if(this.get(STATE) === 'rejected') {
            _onStateChange(this, 'rejected', this.get(VALUE));
        }
        return next;
    },
    resolve : function(value) {
        if(this.get(STATE) === 'pending') {
            _resolve(this, value);
        }

    },
    reject  : function(value) {
        if(this.get(STATE) === 'pending') {
            _onStateChange(this, 'rejected', value);
        }
    },
    catch   : function(onRejected, safeMode) {
        this.safeMode = safeMode != false;
        return this.then(null, onRejected);
    },
    finally : function(onFinally) {
        this.onFinally = onFinally;
    }
};

function _resolve(promise, value) {
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
    value = null;
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
                    var ret = queue.onFulfilled.call(promise, value);
                    queue.next.resolve(ret);
                } catch(exception) {
                    queue.next.reject(exception);
                }

            }
        } else {
            promise.next && promise.next.resolve(value);
        }
        //promise.onRejectedQueue=[];//防止泄露 因为promise状态一旦置为resolve是不可能改变的 那么Rejected回调队列则没什么用了
    }
    else if(state === 'rejected') {
        if(promise.onRejectedQueue.length > 0) {
            while(queue = promise.onRejectedQueue.shift()) {
                try {
                    ret = queue.onRejected.call(promise, value);
                    if(ret === undefined) {
                        //继续异常冒泡
                        queue.next.reject(value);
                    }
                    else if(ret !== false) {
                        //异常恢复
                        queue.next.resolve(ret)
                    }
                    //else if(ret===false) //停止异常冒泡
                } catch(exception) {
                    queue.next.reject(exception);
                    /*//queue.next.reject(exception);
                     if(!promise.safeMode){
                     throw exception;
                     }*/
                }

            }
        } else {
            promise.next && promise.next.reject(value);
        }
        //promise.onFulfilledQueue=[];
    }
    promise.onFinally && promise.onFinally.call(promise, value);
    //GC
    promise.onFinally = null;
}
function all() {

    var data = [],
        p = new Promise(),
        isError = false,
        count = 0;
    if(arguments.length == 1) {
        if(arguments[0] instanceof Array) {
            var args = arguments[0];
        }
        else if(arguments[0].constructor === Object) {
            args = arguments[0];
            data = {}
        }

    }
    else {
        args = arguments;
    }

    function sandGlass(v) {
        count--;
        data[this.idx] = v;
        if(count == 0) {
            if(isError) {
                p.reject(data);
            }
            else {
                p.resolve(data);
            }
        }
    }
    function sandGlassError(v) {
        count--;
        isError = true;
        data[this.idx] = v;
        if(count == 0) {
            p.reject(data);
        }
    }
    if(args.length == 0) {
        p.resolve(data);
    }
    for(var k in args) {
        if(args.hasOwnProperty(k)) {
            count++;
            var pro = args[k];
            if(pro instanceof Promise) {
                pro.idx = k;
                pro.then(sandGlass, sandGlassError);
            }
            else if(typeof pro === 'function') {
                var ret = pro();

                if(ret instanceof Promise) {
                    ret.idx = k;
                    ret.then(sandGlass, sandGlassError);
                }
                else {
                    data[k] = ret;
                    count--;
                }
            }
            else {
                data[k] = pro;
                count--;
            }
            if(count==0){
                p.resolve(data);
            }
        }
    }
    return p;
}
function race() {
    var p = new Promise();

    function sandGlass(v) {
        p.resolve(v);
    }


    for(var i = 0; i < arguments.length; i++) {
        var pro = arguments[i];
        if(pro instanceof Promise) {
            pro.then(sandGlass);
        }
    }
    return p;
}


module.exports = Promise;
Promise.all = all;
Promise.race = race;
