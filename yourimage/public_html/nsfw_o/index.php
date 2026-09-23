
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8">
  <title></title>
  <script type='text/javascript' src='//code.jquery.com/jquery-1.9.1.js'></script>
  <script type='text/javascript' src="http://files.hulea.org/paperjs-v0.9.18/dist/paper-full.min.js"></script>
  <script type='text/javascript' src="http://yourimage.io/dev_2/js/plugins.js"></script>
  <link rel="stylesheet" type="text/css" href="http://yourimage.io/dev_2/css/main.min.css">
  
</head>
<body>
  <div id="contain">
    <div id="preloader" style="display:none;">
        <div id="bar"></div>
        <div id="status">
        <span id="percentage"></span>
    </div>
    </div>
    <div id="outerTools" class="flip-container" style="display:none;font-family:monospace;">
        <div class="flipper">
            <div id="innerTools" class="front">
                <div class="centerImage">
                    <img id="myImg" style="background-color:#fff;max-width:100%;margin:0auto;" src="">
                </div>
                <div id="saveImage">save</div>
                <form xmlns="http://www.w3.org/1999/xhtml" id="canvas-options">
                    <div id="name_download">
                        <input type="hidden" class="filename" id="canvas-filename" placeholder="yourimage" />
                    </div>
                </form>
            </div>
            <div id="info">2014 v1.0 <em><a href="mailto:naeluh@gmail.com" target="_blank">nick hulea</a></em>

            </div>
        </div>
    </div>
    <canvas resize="true" id="mycanvas"></canvas>
</div>
<script type="text/paperscript" canvas="mycanvas">
var r,path,raster,background,imagesrc,path3,preloadAmount=10,cache=[],imgurcache=[],rArray=[],convertedArray=[],ajaxlength=[],autoShowNext=!1,loaded=!1,value=isNaN(value)?0:value,valueajax=isNaN(valueajax)?0:valueajax,press=isNaN(press)?0:press,cvs=document.getElementById("mycanvas"),canvas_options_form=document.getElementById("canvas-options"),canvas_filename=document.getElementById("canvas-filename"),pre=document.getElementById("preloader"),clearCanvas=!1;
function base64(a){var b=new Image,c=document.createElement("canvas"),d=c.getContext("2d");b.crossOrigin="Anonymous";b.onload=function(){c.height=b.height;c.width=b.width;d.drawImage(b,0,0);var a=c.toDataURL("image/png");c=null;preload(a)};b.src=a}function extractToken(a){a=a.match(/access_token=(\w+)/);return!!a&&a[1]}var num=Math.floor(15*Math.random()),token=extractToken(document.location.hash),clientId="b144351ffb05838",auth;authorization=token?"Bearer "+token:"Client-ID "+clientId;
$.ajax({url:"https://api.imgur.com/3/gallery/r/nsfw/time/page="+num,method:"GET",headers:{Authorization:authorization,Accept:"application/json"},crossDomain:!0,data:{image:localStorage.dataBase64,type:"base64"},beforeSend:function(){$("#preloader").css("display","block")},success:handleData});function handleData(a){$.each(a.data,function(b,c){if(!1===a.data[b].animated){var d=c.link;console.log(d);ajaxlength.push({imageamount:valueajax++});base64(d)}})}
function onFrame(a){clearCanvas&&project.activeLayer.hasChildren()&&(project.activeLayer.removeChildren(),clearCanvas=!1)}function onMouseDown(a){0===press&&loaded&&(init(),path2.position=a.point,path.position=a.point)}function onMouseMove(a){0===press&&loaded&&(path2.position=a.point,path.position=a.point)}
function init(){if(cache.length){value++==imgurcache.length-15&&getMoreImages();var a=cache.shift();autoShowNext=!1;r=new Raster(a.source);r.position=view.center;r.size=view.bounds;r.on("load",function(){onResize()});rArray.push(r);path2=new Path.Circle({radius:200,fillColor:"black",shadowColor:"black",shadowBlur:32});path=new Path.Circle({radius:200,fillColor:"black",shadowColor:"black",shadowBlur:32});path2.position=view.center;path.position=view.center;g=new Group([path,r]);g.clipped=!0}else autoShowNext=
!0}
function preload(a){imgun=void 0===a;imgurcache.push({image:a});var b=Math.round(Number(imgurcache.length)/Number(ajaxlength.length)*100),c=Number(imgurcache.length),d=Number(ajaxlength.length);0<=b&&100>=b&&($("#bar").css("width",b+"%"),$("#percentage").html("<b>"+b+"%</b>"));100<=b&&$("#percentage").html("<b>Finishing Up...</b>");c==d&&setTimeout(function(){$("#preloader").fadeOut(250);$("#bar").fadeOut(250);$("#bar").css("width",0);b=0},1E3);var e=new Image;e.onload=function(){cache.push({source:e,position:view.center,
size:view.bounds});cache.length<preloadAmount&&preload();autoShowNext&&init()};imgun||(e.src=a);2==imgurcache.length&&start()}function start(){raster=new Raster(imgurcache[0].image);raster.position=view.center;raster.size=view.bounds;raster.on("load",function(){loaded=!0;onResize()});path2=new Path.Circle({radius:200,fillColor:"black",shadowColor:"black",shadowBlur:32});path=new Path.Circle({radius:200,fillColor:"black",shadowColor:"black",shadowBlur:32});g=new Group([path,raster]);g.clipped=!0}
function onResize(a){background&&background.fitBounds(view.bounds,!0);raster&&raster.fitBounds(view.bounds,!0);rArray.length&&rArray.forEach(function(a){a.fitBounds(view.bounds,!0);a.position=view.center})}
function getMoreImages(){var a=Math.floor(50*Math.random()),b=function(a){a=a.match(/access_token=(\w+)/);return!!a&&a[1]}(document.location.hash);authorization=b?"Bearer "+b:"Client-ID b144351ffb05838";$.ajax({url:"https://api.imgur.com/3/gallery/r/nsfw/time/page="+a,method:"GET",headers:{Authorization:authorization,Accept:"application/json"},crossDomain:!0,data:{image:localStorage.dataBase64,type:"base64"},beforeSend:function(){$("#preloader").css("display","block")},success:function(a){$.each(a.data,
function(b,e){if(!1===a.data[b].animated){var f=e.link;console.log(f);ajaxlength.push({imageamount:valueajax++});base64(f)}})}})}
$(document).keyup(function(a){if("none"==pre.style.display){var b=$("#outerTools");$("#innerTools");32==a.keyCode&&(press++,1===press&&(a=cvs.toDataURL("image/png"),document.getElementById("myImg").src=a,b.show()),2===press&&(b.hide(),press=0),$("#outerTools").on("click",function(a){press=0;b.hide();return!1}),$("#info").bind("click",function(a){a.stopPropagation()}),$("#saveImage").bind("click",function(a){a.stopPropagation()}),$(".centerImage").bind("click",function(a){a.stopPropagation()}))}});
$("#saveImage").on("click",function(){var a=cvs.toDataURL("image/png");document.getElementById("myImg").src=a;cvs.toBlob(function(b){saveAs(b,(canvas_filename.value||canvas_filename.placeholder)+".png");$.ajax({type:"POST",data:{imagetosave:a},url:"saveimage.php",success:function(a){}})},"image/png");return!1});
</script>
  
</body>


</html>

