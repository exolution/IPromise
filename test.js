var Promise=require('./index.js');



function async() {
    var p = new Promise();
    setTimeout(function() {
        p.resolve(1);
    }, 100);
    return p;
}
function async2(d) {
    var p = new Promise();
    setTimeout(function() {
        p.resolve(2);
    }, 200);
    return p;
}


function async3(d) {
    var p = new Promise();
    setTimeout(function() {
        p.reject(3);
    }, 300);
    return p;
}
console.time(1);
Promise.all(async, async2(), async3, 4).then(function(data) {
    console.timeEnd(1);
    console.log(data);
}, function(data) {
    console.log(data);
});
