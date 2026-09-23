window.mobilecheck = function () {
    var check = false;
    (function (a) {
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|android|ipad|playbook|silk|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true
    })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
}

window.isCanvasSupported = function () {
    var elem = document.createElement('canvas');
    return !!(elem.getContext && elem.getContext('2d'));
}

if (isCanvasSupported()) {

    if (mobilecheck()) {


        window.onload = function () {

            sheet = document.getElementById('canvas_not_supported');
            sheet.parentNode.removeChild(sheet);

            document.getElementById('supported').style.display = "block";

            if (!window.requestAnimationFrame) {

                window.requestAnimationFrame = (function () {

                    return window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function ( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {

                        window.setTimeout(update, 1000 / 60);

                    };

                })();

            }

            function preloadImages(srcs, imgs, callback) {
                var img;
                var remaining = srcs.length;
                for (var i = 0; i < srcs.length; i++) {
                    img = new Image();
                    img.onload = function () {
                        --remaining;
                        if (remaining <= 0) {
                            callback();
                        }
                    };
                    img.src = srcs[i];
                    imgs.push(img);
                }
            }

            imageSrcs = [
                "./imgs/lh_edit_v2.png", /*0*/
                "./imgs/rh_edit_v2.png", /*1*/
                "./imgs/lh_edit_slice_v2.png", /*2*/
                "./imgs/rh_edit_slice_v2.png", /*3*/
                "./imgs/cloud_final_2.png", /*4*/
                "./imgs/cloud_4.png", /*5*/
                "./imgs/sky.jpg", /*6*/
                "./imgs/vid_yt_right.png", /*7*/
                "./imgs/vid_yt_left.png", /*8*/
                "./imgs/lh_edit_thumb_v2.png", /*9*/
                "./imgs/rh_edit_thumb_v2.png"]; /*10*/

            var images = [];

            function init() {
                css();
                draw();
                pClouds();
                resizeCanvas();
                requestAnimationFrame(update);
            }

            preloadImages(imageSrcs, images, init);

            var canvas = document.getElementById("myCanvas");
            var canvas2 = document.getElementById("myCanvas2");
            var center = document.getElementById("center");
            var hands = document.getElementById("hands");
            var vid = document.getElementById("videoWrapper");
            var video = document.getElementById("bj_vid");
            var vWrapper = document.getElementById("videoWrapper");
            var leftHand = document.getElementById("left");
            var rightHand = document.getElementById("right");
            var txt = document.getElementById("txtImages");
            var vidWidth, vidHeight;
            var W = window.outerWidth;
            var H = window.outerHeight;
            var m = Math.min(W, H);
            var s = m * 5.5E-4;
            canvas.width = W;
            canvas.height = H;
            canvas2.width = W;
            canvas2.height = H;
            var ctx = canvas.getContext("2d");
            var ctx2 = canvas2.getContext("2d");
            var clouds = [images[4], images[5]];
            var idx = 0;
            var vel = 0.55;
            var v = isNaN(v) ? 0 : v;
            var f = isNaN(f) ? 0 : f;
            var alpha = 1;
            var alpha2 = 1;
            var alpha3 = 1;
            var alphaTxt = 0;
            var particles = [];
            for (var i = 0; i < 100; i++) {
                particles.push(new create_particle());
            }

            function create_particle() {
                this.x = Math.random() * W / Math.random() / Math.random() - 200;
                this.y = Math.random() * H / Math.random() / Math.random() - 200;
                this.vx = Math.random() * vel;
                this.vy = Math.random() * vel;
                this.radius = Math.random() * 20 + 20;
            }

            var x = 100;
            var y = 100;

            var pClouds = function () {
                ctx2.save();
                ctx2.setTransform(1, 0, 0, 1, 0, 0);
                ctx2.rect(0, 0, canvas.width, canvas.height);
                ctx2.drawImage(images[6], 0, 0, W, H);
                ctx2.restore();
                for (var i = 0; i < particles.length; i++) {
                    var p = particles[i];
                    var cl = clouds[idx++ % clouds.length];
                    ctx2.beginPath();
                    ctx2.globalCompositeOperation = "source-over";
                    ctx2.fillStyle = "white";
                    ctx2.drawImage(cl, p.x, p.y, cl.width * 0.5, cl.height * 0.5);
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.x < -1E3) {
                        p.x = W + 1E3;
                    }
                    if (p.y < -1E3) {
                        p.y = H + 1E3;
                    }
                    if (p.x > W + 1E3) {
                        p.x = -1E3;
                    }
                    if (p.y > H + 1E3) {
                        p.y = -1E3;
                    }
                }
            };
            var css = function () {
                vidWidth = images[7].width * s + images[8].width * s;
                vidHeight = images[7].height * s;
                lhWidth = images[2].width * s;
                lhHeight = images[0].height * s;
                rhWidth = images[3].width * s;
                rhHeight = images[1].height * s;
                leftHand.style.maxWidth = lhWidth + "px";
                leftHand.style.minWidth = lhWidth + "px";
                leftHand.style.maxHeight = lhHeight + "px";
                leftHand.style.minHeight = lhHeight + "px";
                rightHand.style.maxWidth = rhWidth + "px";
                rightHand.style.minWidth = rhWidth + "px";
                rightHand.style.maxHeight = rhHeight + "px";
                rightHand.style.minHeight = rhHeight + "px";
                center.style.maxWidth = vidWidth + "px";
                center.style.minWidth = vidWidth + "px";
                hands.style.maxWidth = vidWidth + "px";
                hands.style.minWidth = vidWidth + "px";
                vid.style.maxWidth = vidWidth + "px";
                vid.style.maxHeight = vidHeight + "px";
                vid.style.minWidth = vidWidth + "px";
                vid.style.minHeight = vidHeight + "px";
            };

            var lastTs = Date.now();

            var draw = function () {
                m = Math.min(W, H);

                /*Mobile*/
                s = m * 5.5E-4;

                css();

                //calc hands

                var calc = images[7].width / 2 - images[3].width / 2;

                if (0 < v < calc) {
                    ch = 32.75 * s;
                }

                var delta = Date.now() - lastTs;

                v += 0.3 * delta / 1E3;

                var mov = f * 2 * s;

                
                if (v > 0) {
                 
                    ch = (ch -= (mov/50) * delta / 1E3);
                    
                    if (ch < 0) {
                        ch = 0;
                    }
                }
                

                if (v > 10) {
                    f += 0.3 * delta / 1E3;
                }


                if (f > calc) {
                    f = calc;
                    
                    ch = (ch -= (mov/50) * delta / 1E3) * s;
                    if (ch < 0) {
                        ch = 0;
                    }
        
                    vWrapper.style.display = "block";
                    leftHand.style.display = "block";
                    rightHand.style.display = "block";
                    txt.style.display = "block";
                    txt.style.opacity = alphaTxt;
                    alphaTxt = alphaTxt + 0.01;
                    if (alphaTxt > 1) {
                        alphaTxt = 1;
                    }
                    alpha3 = 0;
                    alpha2 = 0;

                }
                
                //calc hands


                var moveup = 100 * s;
                var mov2 = mov * 1.1;
                var mov3 = mov * 1.12;

                /*right vid*/
                ctx.save();
                ctx.drawImage(images[7], (canvas.width / 2) - 1, canvas.height / 2 - images[7].height * s / 2 - moveup, images[7].width * s, images[7].height * s);
                ctx.globalCompositeOperation = "destination-in";
                ctx.rect((canvas.width / 2) - 1, canvas.height / 2 - images[7].height * s / 2 - moveup, mov2, images[7].height * s);
                ctx.globalAlpha = alpha3;
                ctx.fillStyle = "rgba(0, 0, 0, 1)";
                ctx.fill();
                ctx.restore();

                /*left vid*/
                ctx.save();
                ctx.drawImage(images[8], (canvas.width / 2 - images[8].width * s) + 1, canvas.height / 2 - images[8].height * s / 2 - moveup, images[8].width * s, images[8].height * s);
                ctx.globalCompositeOperation = "destination-in";
                ctx.rect((canvas.width / 2 - mov3) + 1, canvas.height / 2 - images[8].height * s / 2 - moveup, mov3, images[8].height * s);
                ctx.globalAlpha = alpha3;
                ctx.fillStyle = "rgba(0, 0, 0, 1)";
                ctx.fill();
                ctx.restore();

                /*right hand*/
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.drawImage(images[1], canvas.width / 2 + mov - ch, canvas.height / 2 - images[1].height * s / 2, images[1].width * s, images[1].height * s);
                ctx.restore();

                /*left hand*/
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.drawImage(images[0], canvas.width / 2 - images[0].width * s - mov + ch, canvas.height / 2 - images[0].height * s / 2, images[0].width * s, images[0].height * s);
                ctx.restore();

                ctx.globalCompositeOperation = "destination-over";

                /*right thumb*/
                ctx.save();
                ctx.globalAlpha = alpha2;
                ctx.drawImage(images[10], canvas.width / 2 + mov - ch, canvas.height / 2 - images[10].height * s / 2, images[10].width * s, images[10].height * s);
                ctx.restore();

                /*left thumb*/
                ctx.save();
                ctx.globalAlpha = alpha2;
                ctx.drawImage(images[9], canvas.width / 2 - images[9].width * s - mov + ch, canvas.height / 2 - images[9].height * s / 2, images[9].width * s, images[9].height * s);
                ctx.restore();


            };
            var update = function () {
                requestAnimationFrame(update);
                W = window.outerWidth;
                H = window.outerHeight;
                canvas.width = W;
                canvas.height = H;
                canvas2.width = W;
                canvas2.height = H;
                pClouds();
                draw();
            };

            var resizeCanvas = function () {
                W = window.outerWidth;
                H = window.outerHeight;
                canvas.width = W;
                canvas.height = H;
                canvas2.width = W;
                canvas2.height = H;
                css();
                draw();
                pClouds();
            };

            window.addEventListener("orientationchange", resizeCanvas, false);
            window.addEventListener("resize", resizeCanvas, false);


        };

    } else {

        window.onload = function () {

            sheet = document.getElementById('canvas_not_supported');
            sheet.parentNode.removeChild(sheet);
            document.getElementById('supported').style.display = "block";



            if (!window.requestAnimationFrame) {

                window.requestAnimationFrame = (function () {

                    return window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function ( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {

                        window.setTimeout(update, 1000 / 60);

                    };

                })();

            }


            function preloadImages(srcs, imgs, callback) {
                var img;
                var remaining = srcs.length;
                for (var i = 0; i < srcs.length; i++) {
                    img = new Image();
                    img.onload = function () {
                        --remaining;
                        if (remaining <= 0) {
                            callback();
                        }
                    };
                    img.src = srcs[i];
                    imgs.push(img);
                }
            }

            imageSrcs = [
                "./imgs/lh_edit_v2.png", /*0*/
                "./imgs/rh_edit_v2.png", /*1*/
                "./imgs/lh_edit_slice_v2.png", /*2*/
                "./imgs/rh_edit_slice_v2.png", /*3*/
                "./imgs/cloud_final_2.png", /*4*/
                "./imgs/cloud_4.png", /*5*/
                "./imgs/sky.jpg", /*6*/
                "./imgs/vid_yt_right.png", /*7*/
                "./imgs/vid_yt_left.png", /*8*/
                "./imgs/lh_edit_thumb_v2.png", /*9*/
                "./imgs/rh_edit_thumb_v2.png"]; /*10*/

            var images = [];

            function init() {
                css();
                draw();
                pClouds();
                resizeCanvas();
                requestAnimationFrame(update);
            }

            preloadImages(imageSrcs, images, init);

            var canvas = document.getElementById("myCanvas");
            var canvas2 = document.getElementById("myCanvas2");
            var center = document.getElementById("center");
            var hands = document.getElementById("hands");
            var vid = document.getElementById("videoWrapper");
            var video = document.getElementById("bj_vid");
            var vWrapper = document.getElementById("videoWrapper");
            var leftHand = document.getElementById("left");
            var rightHand = document.getElementById("right");
            var txt = document.getElementById("txtImages");
            var vidWidth, vidHeight;
            var W = window.outerWidth;
            var H = window.outerHeight;
            var m = Math.min(W, H);
            var s = m * 7.5E-4;
            canvas.width = W;
            canvas.height = H;
            canvas2.width = W;
            canvas2.height = H;
            var ctx = canvas.getContext("2d");
            var ctx2 = canvas2.getContext("2d");
            var clouds = [images[4], images[5]];
            var idx = 0;
            var vel = 0.55;
            var v = isNaN(v) ? 0 : v;
            var f = isNaN(f) ? 0 : f;
            var alpha = 1;
            var alpha2 = 1;
            var alpha3 = 1;
            var alphaTxt = 0;
            var particles = [];
            var x = 100;
            var y = 100;
            

            for (var i = 0; i < 100; i++) {
                particles.push(new create_particle());
            }

            function create_particle() {
                this.x = Math.random() * W / Math.random() / Math.random() - 200;
                this.y = Math.random() * H / Math.random() / Math.random() - 200;
                this.vx = Math.random() * vel;
                this.vy = Math.random() * vel;
                this.radius = Math.random() * 20 + 20;
            }

            var pClouds = function () {
                ctx2.save();
                ctx2.setTransform(1, 0, 0, 1, 0, 0);
                ctx2.rect(0, 0, canvas.width, canvas.height);
                ctx2.drawImage(images[6], 0, 0, W, H);
                ctx2.restore();
                for (var i = 0; i < particles.length; i++) {
                    var p = particles[i];
                    var cl = clouds[idx++ % clouds.length];
                    ctx2.beginPath();
                    ctx2.globalCompositeOperation = "source-over";
                    ctx2.fillStyle = "white";
                    ctx2.drawImage(cl, p.x, p.y, cl.width * 0.5, cl.height * 0.5);
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.x < -1E3) {
                        p.x = W + 1E3;
                    }
                    if (p.y < -1E3) {
                        p.y = H + 1E3;
                    }
                    if (p.x > W + 1E3) {
                        p.x = -1E3;
                    }
                    if (p.y > H + 1E3) {
                        p.y = -1E3;
                    }
                }
            };

            var css = function () {
                vidWidth = images[7].width * s + images[8].width * s;
                vidHeight = images[7].height * s;
                lhWidth = images[2].width * s;
                lhHeight = images[0].height * s;
                rhWidth = images[3].width * s;
                rhHeight = images[1].height * s;
                leftHand.style.maxWidth = lhWidth + "px";
                leftHand.style.minWidth = lhWidth + "px";
                leftHand.style.maxHeight = lhHeight + "px";
                leftHand.style.minHeight = lhHeight + "px";
                rightHand.style.maxWidth = rhWidth + "px";
                rightHand.style.minWidth = rhWidth + "px";
                rightHand.style.maxHeight = rhHeight + "px";
                rightHand.style.minHeight = rhHeight + "px";
                center.style.maxWidth = vidWidth + "px";
                center.style.maxHeight = vidHeight + "px";
                center.style.minWidth = vidWidth + "px";
                center.style.minHeight = vidHeight + "px";
                hands.style.maxWidth = vidWidth + "px";
                hands.style.minWidth = vidWidth + "px";
                vid.style.maxWidth = vidWidth + "px";
                vid.style.maxHeight = vidHeight + "px";
                vid.style.minWidth = vidWidth + "px";
                vid.style.minHeight = vidHeight + "px";
                //video.style.maxHeight = vidHeight + "px";
                //video.style.minHeight = vidHeight + "px";
            };

            var lastTs = Date.now();

            var draw = function () {
                m = Math.min(W, H);

                /*Desktop*/
                s = m * 7.5E-4;

                css();
                
                //calc hands

                var calc = images[7].width / 2 - images[3].width / 2;

                if (0 < v < calc) {
                    ch = 32.75 * s;
                }

                var delta = Date.now() - lastTs;

                v += 0.3 * delta / 1E3;

                var mov = f * 2 * s;

                
                if (v > 0) {
                 
                    ch = (ch -= (mov/50) * delta / 1E3);
                    
                    if (ch < 0) {
                        ch = 0;
                    }
                }
                

                if (v > 10) {
                    f += 0.3 * delta / 1E3;
                }


                if (f > calc) {
                    f = calc;
                    
                    ch = (ch -= (mov/50) * delta / 1E3) * s;
                    if (ch < 0) {
                        ch = 0;
                    }
        
                    vWrapper.style.display = "block";
                    leftHand.style.display = "block";
                    rightHand.style.display = "block";
                    txt.style.display = "block";
                    txt.style.opacity = alphaTxt;
                    alphaTxt = alphaTxt + 0.01;
                    if (alphaTxt > 1) {
                        alphaTxt = 1;
                    }
                    alpha3 = 0;
                    //alpha2 = 0;

                }
                
                //calc hands


                var moveup = 100 * s;
                var mov2 = mov * 1.1;
                var mov3 = mov * 1.12;

                center.style.bottom = 25.125 * s + "em"
                canvas.style.bottom = 6.25 * s + "em"
                leftHand.style.bottom = 12.25 * s + "em"
                rightHand.style.bottom = 12.25 * s + "em"

                //center.style.bottom = 12.125 * s + "em"


                /*right vid*/
                ctx.save();
                //ctx.globalCompositeOperation = "source-over";
                ctx.drawImage(images[7], (canvas.width / 2) - 1, canvas.height / 2 - images[7].height * s / 2 - moveup, images[7].width * s, images[7].height * s);
                ctx.globalCompositeOperation = "destination-in";
                ctx.rect((canvas.width / 2) - 1, canvas.height / 2 - images[7].height * s / 2 - moveup, mov2, images[7].height * s);
                ctx.globalAlpha = alpha3;
                ctx.fillStyle = "rgba(0, 0, 0, 1)";
                ctx.fill();
                ctx.restore();

                /*left vid*/
                ctx.save();
                ctx.drawImage(images[8], (canvas.width / 2 - images[8].width * s) + 1, canvas.height / 2 - images[8].height * s / 2 - moveup, images[8].width * s, images[8].height * s);
                ctx.globalCompositeOperation = "destination-in";
                ctx.rect((canvas.width / 2 - mov3) + 1, canvas.height / 2 - images[8].height * s / 2 - moveup, mov3, images[8].height * s);
                ctx.globalAlpha = alpha3;
                ctx.fillStyle = "rgba(0, 0, 0, 1)";
                ctx.fill();
                ctx.restore();

                /*right hand*/
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.drawImage(images[1], canvas.width / 2 + mov - ch, canvas.height / 2 - images[1].height * s / 2, images[1].width * s, images[1].height * s);
                ctx.restore();

                /*left hand*/
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.drawImage(images[0], canvas.width / 2 - images[0].width * s - mov + ch, canvas.height / 2 - images[0].height * s / 2, images[0].width * s, images[0].height * s);
                ctx.restore();

                ctx.globalCompositeOperation = "destination-over";

                /*right thumb*/
                ctx.save();
                ctx.globalAlpha = alpha2;
                ctx.drawImage(images[10], canvas.width / 2 + mov - ch, canvas.height / 2 - images[10].height * s / 2, images[10].width * s, images[10].height * s);
                ctx.restore();

                /*left thumb*/
                ctx.save();
                ctx.globalAlpha = alpha2;
                ctx.drawImage(images[9], canvas.width / 2 - images[9].width * s - mov + ch, canvas.height / 2 - images[9].height * s / 2, images[9].width * s, images[9].height * s);
                ctx.restore();

            };

            var update = function () {
                requestAnimationFrame(update);
                W = window.innerWidth;
                H = window.innerHeight;
                canvas.width = W;
                canvas.height = H;
                canvas2.width = W;
                canvas2.height = H;
                pClouds();
                draw();
            };

            var resizeCanvas = function () {
                W = window.innerWidth;
                H = window.innerHeight;
                canvas.width = W;
                canvas.height = H;
                canvas2.width = W;
                canvas2.height = H;
                css();
                draw();
                pClouds();
            };

            window.addEventListener("orientationchange", resizeCanvas, false);
            window.addEventListener("resize", resizeCanvas, false);


        };

    }

} else {

    window.onload = function () {
        document.body.style.backgroundImage = "url('http://aa8f47fcc01b7584f779-b57f388ffba74a9d5600392ce75da4b1.r13.cf2.rackcdn.com/sky.jpg')";
        document.getElementById('not_supported').style.display = "block";
        sheet = document.getElementById('canvas_supported');
        sheet.parentNode.removeChild(sheet);

    }

}