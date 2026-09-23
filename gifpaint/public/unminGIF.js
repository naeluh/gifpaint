    //LAST UPDATED 01/29/2015
    //Check on this CHROME Version 40.0.2214.93 m (64-bit) breaks shadowBlur 

    var ajaxlength = [];
    var value = isNaN(value) ? 10 : value;
    var animationFrame = new AnimationFrame();
    var ct = [];
    var ct2 = [];
    var g = [];
    var canarr = [];
    var canarr2 = [];
    var trueArr = [];
    var pos = [];
    var prevVelocity = null;
    var ok = document.getElementById('ok');

    function extractToken(hash) {
        var match = hash.match(/access_token=(\w+)/);
        return !!match && match[1];
    }
    var token = extractToken(document.location.hash);
    var clientId = "b144351ffb05838";

    if (token) {authorization = "Bearer " + token;} else {authorization = "Client-ID " + clientId;}

    $.ajax({
        url         : "https://api.imgur.com/3/gallery/random/random/page=" + Math.floor(Math.random() * 50),
        method      : "GET",
        headers     : {Authorization: authorization, Accept: "application/json"},
        crossDomain : true,
        data        : {image: localStorage.dataBase64, type: "base64"},
        beforeSend  : function () {$("#loading").css("display", "block");},
        success     : function (result) {
            $.each(result.data, function (idx, image) {
                 if ((result.data[idx].animated !== false) && (result.data[idx].is_album !== true) && (result.data[idx].type === 'image/gif') && (result.data[idx].size < 2E6)) {
                    var newimage = GIF(image.link);
                    newimage.render();
                    g.push (newimage);
                    recursiveLoad(newimage);
                }
            });
        }
    });
 
    ok.addEventListener('click',function(){
      $("#contain").fadeOut(1E2);
      init();
    });

   function recursiveLoad(img) {
     setTimeout(function() {
       var colorA = "#" + Math.random().toString(16).slice(2, 8);
       if (img.rendered === true) {
         done(img, colorA);
       } else {
         recursiveLoad(img);
       }
     }, 1000);
   }

   function done(image, color) {
     trueArr.push(image.src);
     $("#loading").append('<p style="color:' + color + ';">' + trueArr.length + '</>');
     if (g.length === trueArr.length) {
       $("#loading").fadeOut(1E2);
       $("#gifs").append('Number of gifs this session: '+g.length);
       $("#instructions").fadeIn(1E2);
       //$("#contain").fadeOut(1E2);
       animloop();
     }
   }

   function calculateVelocities(pos) {
     return pos.reduce(function(out, pos, index, posArr) {
       if (index > 0) {
         var prevIndex = index - 1;
         var dx = pos.x - posArr[prevIndex].x;
         var dy = pos.y - posArr[prevIndex].y;
         out.push(Math.sqrt(dx * dx + dy * dy) / (posArr[prevIndex].t - pos.t));
       }
       return out;
     }, []);
   }

   function calculateAccelerations(vels) {
     return vels.reduce(function(out, vel, index, velsArr) {
       if (index > 0) {
         var prevIndex = index - 1;
         out.push(velsArr[prevIndex] - vel);
       }
       return out;
     }, []);
   }

   function average(arr) {
     if (arr.length > 0) {
       return arr.reduce(function(sum, val) {
         return sum + val;
       }, 0) / arr.length;
     }
     return 0;
   }

   function createCanvas(arrayOne, arrayTwo) {
     var canvas = document.createElement('canvas');
     canvas.width = window.innerWidth;
     canvas.height = window.innerHeight;
     document.body.appendChild(canvas);
     var context = canvas.getContext('2d');
     arrayOne.push(context);
     if (arrayTwo) {
       arrayTwo.push(canvas);
     }
   }

   function create(e) {
     createCanvas(ct, canarr);
     createCanvas(ct2);
     e.preventDefault();
   }

   function drawMobi(e) {
     if (ctx2 !== undefined) {
       ctx2.globalCompositeOperation = 'source-over';
       ctx2.beginPath();
       //ctx2.shadowBlur = 20;
       //ctx2.shadowColor = 'rgb(0, 0, 0)';
       ctx2.arc(e.touches[0].clientX, e.touches[0].clientY, 34, 0, Math.PI * 2, false);
       //ctx2.arc(e.pageX/2, e.pageY/2, r, 0, Math.PI * 2, false);
       ctx2.fillStyle = "rgba(0,0,0,0.5)";
     }
     e.preventDefault();
   }

   function drawDesk(e) {
     pos.unshift({
       x: e.clientX,
       y: e.clientY,
       t: performance.now()
     });
     pos.length = Math.min(pos.length, 30);
     var vels = calculateVelocities(pos);
     var accels = calculateAccelerations(vels);
     var vel = average(vels);
     var accel = average(accels);
     if (accel >= 0) {
       r = value++;
     } else {
       r = value--;
     }
     if (r > 100) {
       r = value -= 100;
     }
     if (r < 5) {
       r = value += 100;
     }
     var ctx2 = ct2[(Number(ct2.length) - 1)];
     var can = ct2[(Number(ct2.length) - 1)];
     if ((Number(ct2.length) - 1) >= Number(g.length)) {
       ctx2 = ct2[(Number(g.length) - 1)];
       can = ct2[(Number(g.length) - 1)];
     }
     if (ctx2 !== undefined) {
       ctx2.globalCompositeOperation = 'source-over';
       ctx2.beginPath();
       ctx2.shadowBlur = 20;
       ctx2.shadowColor = 'rgb(0, 0, 0)';
       ctx2.arc(e.clientX, e.clientY, r, 0, Math.PI * 2, false);
       ctx2.fillStyle = "rgba(0,0,0,0.5)";
     }
     e.preventDefault();
   }

   function init(){
     if (Modernizr.touch) {
     document.addEventListener('touchstart', create);
     document.addEventListener('touchmove', drawMobi);
       } else {
     window.addEventListener('mousedown', create);
     window.addEventListener('mousemove', drawDesk);
     }
   }

   function animloop() {
     animationFrame.request(animloop);
     for (var i = 0; i < g.length; i++) {
       var gifNum = i % g.length;
       var gif = g[gifNum];
       var ctx = ct[gifNum];
       var ctx2 = ct2[gifNum];
       var can = canarr[gifNum];
       if (ct.length > 0 && ct2.length > 0 && canarr.length > 0 && g.length > 0 && ctx !== undefined) {
         if (gif.rendered === true && gif.loaded === true) {
           ctx2.fill();
           ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
           ctx.globalCompositeOperation = 'source-over';
           ctx2.globalCompositeOperation = 'source-atop';
           ctx2.drawImage(gif.frames[gif.currentFrame()].ctx.canvas, 0, 0, window.innerWidth, window.innerHeight);
           ctx.drawImage(can, 0, 0, window.innerWidth, window.innerHeight);
           ctx.globalCompositeOperation = 'source-atop';
         }
       }
     }
   }