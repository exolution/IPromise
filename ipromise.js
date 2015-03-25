/**
 * A link-style promise Implementation
 */
var _Slice = Array.prototype.slice;
var _when = function() {
    var count = arguments.length;
    var args = [], p = this;

    function sandGlass() {//计时器 作为when里所有promise的then 每个promise 完成时 count递减 当count为0时代表when里所有的promise都完成了 此时resolve when这个promise
        count--;
        args[this.params.index] = arguments.length==1?arguments[0]:_Slice.call(arguments);
        if(count == 0) {
            p.resolve.apply(p, args);
        }
    }

    for(var i = 0; i < arguments.length; i++) {
        var pro = arguments[i];
        if(typeof pro === 'function') {
            var ret = pro();
            if(ret instanceof Promise) {
                ret.then(sandGlass);
                ret.params.index=i;
            }
            else {
                count--;
                args[i] = ret;
            }
        }
        else if(pro instanceof Promise){
            pro.then(sandGlass);
            pro.params.index=i;
        }
        else {
            args[i] = pro;
            count--;
        }
    }
    if(count==0){
        p.resolve.apply(p, args);
    }
    return p;
};
var _any = function() {

    var args = [], p = this;

    function sandGlass() {//计时器 作为when里所有promise的then 每个promise 完成时 count递减 当count为0时代表when里所有的promise都完成了 此时resolve when这个promise
        if(p.state == 'pending') {

            p.resolve.apply(p, args);
        }
    }

    for(var i = 0; i < arguments.length; i++) {
        var pro = arguments[i];
        if(typeof pro === 'function') {
            var ret = pro();
            if(ret instanceof Promise) {
                ret.then(sandGlass);
                ret.index = i;
            }
            else {
                count--;
                args[i] = ret;
            }
        }
        else {
            args[i] = pro;
            count--;
        }
    }
    return p;

};
var _cache = {}, _uuid = 0;

var Promise = module.exports = function Promise(func) {
    this.state = 'pending';
    this.params={};
    if(typeof func === 'function') {
        var p = this;
        func(function() {
            p.resolve.apply(p, _Slice.call(arguments));
        }, function() {
            p.reject.apply(p, _Slice.call(arguments));
        })
    }
    this.uuid = _uuid++;
}

Promise.prototype = {
    then      : function(onFulfilled, onRejected) {
        this.onFulfilled = onFulfilled;
        this.onRejected = onRejected;
        this.next = new Promise();//生成新的Promise 此Promise实际上是对可能的后续异步函数结果的一个保证
        if(this.state == 'fulfilled') {
            this.resolve.apply(this, _cache[this.uuid]);
        }
        if(this.state == 'reject') {
            this.reject.apply(this, _cache[this.uuid]);
        }
        return this.next;
    },
    resolve   : function() {
        if(this.next) {
            if(this.onFulfilled) {
                this.state = 'fulfilled';
                var ret = this.onFulfilled.apply(this, _Slice.call(arguments));
                if(ret instanceof Promise) {
                    //移花接木 将当前promise onFulfilled函数中生成的promise转化成当前的后续promise(该后续promise本身就是为它预生成的)
                    ret.onFulfilled = this.next.onFulfilled;
                    ret.onRejected = this.next.onRejected;
                    ret.uuid = this.next.uuid;
                    ret.next = this.next.next;
                    ret.params=this.next.params;
                    if(ret.next == null) {
                        //借尸还魂 当前promise的onFulfilled函数已经是最后一个函数 生成的promise无法被用户引用，因此需要把fulfill状态置回为它预生成的那个promise上一遍后续的then
                        ret.proto = this.next;
                    }
                }
                else {
                    var p = new Promise();
                    p.onFulfilled = this.next.onFulfilled;
                    p.onRejected = this.next.onRejected;
                    p.uuid = this.next.uuid;
                    p.next = this.next.next;
                    p.params=this.next.params;
                    if(p.next == null) {
                        p.proto = this.next;
                    }
                    if(ret) {
                        p.resolve(ret);
                    }
                    else{
                        p.resolve.apply(p, _Slice.call(arguments));
                    }
                }
            }
            else {
                this.next.resolve();
            }
        }
        else {
            if(this.proto) {
                this.proto.state = 'fulfilled';
                _cache[this.proto.uuid] = _Slice.call(arguments);
            }
            else {
                this.state = 'fulfilled';
                _cache[this.uuid] = _Slice.call(arguments);
            }

        }
        return this;
    },
    reject    : function() {
        this.state = 'reject';
        if(this.onRejected) {
            this.onRejected.apply(this, _Slice.call(arguments));
        }
        else {
            if(this.next) {
                this.next.reject.apply(this.next, _Slice.call(arguments));//错误冒泡
            }
            else {
                _cache[this.uuid] = _Slice.call(arguments);
            }

        }
    },
    when      : function() {
        _when.apply(this, _Slice.call(arguments));
        return this;
    },
    crossFire : function() {

    },
    value     : function(n) {
        if(typeof n == 'number') {
            return _cache[this.uuid][n];
        }
        return _cache[this.uuid];
    }
};

Promise.when = function() {
    var p = new Promise();
    _when.apply(p, _Slice.call(arguments));
    return p;
};
