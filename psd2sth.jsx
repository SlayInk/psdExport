var fileName = '';
var layerVisibility ;
app.activeDocument.suspendHistory('All Modification', 'main()');

function main(){
  if(!isPsdSaved()) {
    alert("Save the psd and try again");
    return;
  }
  showDialog();
}

function showDialog(){
  var dialog =  new Window("dialog","Export Option");
  dialog.savePNG = dialog.add("checkbox", undefined, "Export PNG");
  dialog.savePNG.value = false;
  dialog.savePNG.alignment = "left";
  
  dialog.saveDescFile = dialog.add("checkbox", undefined, "Export DesFile");
  dialog.saveDescFile.value = false;
  dialog.saveDescFile.alignment = "left";
  
  dialog.ignoreHiddenLayers = dialog.add("checkbox", undefined, "Ignore Hidden Layers");
  dialog.ignoreHiddenLayers.value = false;
  dialog.ignoreHiddenLayers.alignment = "left";
  
  var confirmGroup = dialog.add("group", [0,0,180,50]);
  var okBtn = confirmGroup.add("button",[10,10,50,35], "OK");
  var cancelBtn = confirmGroup.add("button",[90,10,170,35], "Cancel");
  
  okBtn.onClick =  function(){
    var exportOption = {
      savePNG : dialog.savePNG.value,
      saveDescFile : dialog.saveDescFile.value,
      ignoreHiddenLayers : dialog.ignoreHiddenLayers.value,
    };
    tryExport(exportOption);
    close(dialog);
  };
    dialog.show();
}

function tryExport(options){
  if(!options.savePNG && !options.saveDescFile) return ;
  
  fileName = decodeURI(app.activeDocument.name);
  fileName = fileName.substring(0, fileName.indexOf('.'));
  var exportPath = app.activeDocument.path + "/" + fileName + "/";
    
  var usedLayers = [];
  getLayers(app.activeDocument, usedLayers);
  layerVisibility = new Array();
  for (var i = usedLayers.length - 1; i >= 0 ; --i){
    var layer = usedLayers[i];
    layerVisibility[layer] = getLayerVisiable(layer);
  }
  
  mkDir(exportPath);
  if(options.saveDescFile) {
    var descStr = '';
    for(var i = app.activeDocument.layers.length -1; i >= 0 ; --i){
      descStr += getLayerDesc(app.activeDocument.layers[i], options, 1);
    }
    exportDesc(descStr,exportPath);
  }
  
  if(options.savePNG) {
    for(var i = usedLayers.length -1; i >= 0 ; --i){
      exportPNG(usedLayers[i], options, exportPath);
    }
  }
}

function getLayerDesc(layer,options, deepth) {
  if(options.ignoreHiddenLayers && layerVisibility[layer] == false) return '';
  
  var desc = '';
  if(layer.kind == "LayerKind.TEXT") {
    desc += makeTextDesc(layer, deepth);
  }else if(layer.typename == 'LayerSet'){
    if(layer.name.split('$')[1] == 'Button') {
      desc += makeButtonDesc(layer, deepth);
    }else {
      for (var i = layer.layers.length - 1; i >= 0 ; --i){
        desc += getLayerDesc(layer.layers[i], options, deepth +1);
      }
    }
  }else{
      desc += makeIndent(deepth);
      var obj = getPosAndWH(layer);
      var name = replace(layer.name);
      desc += '<e:Image id="'+name+'" width="'+obj.w+'" height="'+obj.h+'" source="'+name+'_png" x="'+obj.x+'" y="'+obj.y+'" />\n';
  }
  return desc;
}

function makeTextDesc(layer, deepth, bounds){
  var name = replace(layer.name);
  var color = 'FFFFFF';
  var alignment = Justification.LEFT;
  // no property like color,justification,etc when it is not change
  try{
    if(layer.textItem.hasOwnProperty('color')){
      color = layer.textItem.color.rgb.hexValue;
    }
  }catch(e){color = 'FFFFFF';};
  try{
    if(layer.textItem.hasOwnProperty('justification')){//sometime it does not work
      alignment = layer.textItem.justification;
    }
  }catch(e){alignment = Justification.LEFT;};
  function alisas(obj){
    if(!obj) obj = Justification.LEFT;
    return obj.toString().split('.')[1].toLocaleLowerCase();
  }
  var contents = layer.textItem.contents.replace(/(\n)|(\r)/g,'');
  var obj = bounds? bounds : getPosAndWH(layer);

  return makeIndent(deepth)+'<e:Label id="text'+name+'" text="'+contents+'" size="'+Math.ceil(layer.textItem.size)+'" x="'+obj.x+'" y="'+obj.y+'" textAlign="'+
        alisas(alignment) + '" width="'+obj.w+'" height="'+obj.h+'" fontFamily="'+layer.textItem.font+'" textColor="0x'+color+'" />\n';
}

//a layerset name as "$Button", and contais status img and maybe button textlayer
function makeButtonDesc(layerSet, deepth) {
  var layers = layerSet.layers;
  if (layers.length <= 0) return '';
  var desc = makeIndent(deepth);
  var name = replace(layerSet.name.split('$')[0]);
  var x,y,w,h;
  var textLayer;
  var imgArr = new Array(3);
  for(var idx = layers.length - 1; idx >= 0; -- idx) {
    var layer = layers[idx];
    if(layer.typename == 'ArtLayer' && layer.kind != "LayerKind.TEXT") {
      var obj = getPosAndWH(layer);
      x = !x ? obj.x : (obj.x < x ? obj.x : x);
      y = !y ? obj.y : (obj.y < y ? obj.y : y);
      //bottom right point
      w = !w ? obj.x+obj.w : (obj.x+obj.w > w ? obj.x+obj.w : w);
      h = !h ? obj.y+obj.h : (obj.y+obj.h > h ? obj.y+obj.h : h);
    }
    if(layer.kind == "LayerKind.TEXT") {
      textLayer = layer;
    }else{
      var pTag = layer.name.split('_btn_')[1];
      if(pTag == 'up') imgArr[0] = layer;
      else if(pTag == 'down') imgArr[1] = layer;
      else if(pTag == 'dis') imgArr[2] = layer;
    }
  }
    
  x = Math.ceil(x);
  y = Math.ceil(y);
  w = Math.ceil(w - x);//real width
  h = Math.ceil(h - y);
    
  var tmpDeepth = 0;
  desc += '<e:Button id="' +name+'Btn" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'">\n';
  desc += makeIndent(deepth + ++tmpDeepth);
  desc += '<e:skinName>\n';
  desc += makeIndent(deepth + ++tmpDeepth);
  desc += '<e:Skin states="up,down,disable" xmlns:ns1="*">\n';
  
  if (textLayer) {
    var obj = getPosAndWH(textLayer);
    obj.x = obj.x - x;// relative to textLayer.parent
    obj.y = obj.y - y;
    desc += makeTextDesc(textLayer, deepth + tmpDeepth, obj);
  }
  desc += makeIndent(deepth + tmpDeepth);
  
  var obj = getPosAndWH(imgArr[0]);
  var donwDesc=  imgArr[1] ? ('source.down="'+imgArr[1].name+'_png" ' ): '' ;
  var disDesc= imgArr[2] ? ('source.disable="'+ imgArr[2].name+'_png" ') : '';
  desc += '<e:Image width="'+obj.w+'" height="'+obj.h+'" source="'+imgArr[0].name+'_png" '+
                donwDesc +
                 disDesc+
                '/>\n';
  desc += makeIndent(deepth + tmpDeepth--);
  desc += '</e:Skin>\n';
  desc += makeIndent(deepth + tmpDeepth--);
  desc += '</e:skinName>\n';
  desc += makeIndent(deepth + tmpDeepth--);
  desc += '</e:Button>\n';
  return desc;
}

function mkDir(path) {
  var folder = Folder(path + "/texture/");
  if(!folder.exists)  folder.create();
  
  folder = Folder(path + "/exml/");
  if(!folder.exists)  folder.create();
}

function exportDesc(descStr,exportPath){
  if (!descStr || !exportPath || descStr.length <= 0 || exportPath.length <= 0) return ;
  var desc = '<?xml version="1.0" encoding="utf-9"?>\n';
  desc += '<e:Skin class="WndSkin" xmlns:e="http://ns.egret.com/eui" xmlns:nsl="*" xmlns:w="http://ns.egret.com/wing">\n';
  desc += descStr;
  desc += '</e:Skin>';
  
  var file = new File(exportPath + "/exml/" + fileName + '.exml');
  file.remove();
  file.open("a");
  file.lineFeed = "\n";
  file.encoding = "utf-8";
  file.write(desc);
  file.close();
}

function exportPNG(layer, options, exportPath){
  if (!layer || !exportPath ||exportPath.length <= 0) return ;
  if(layer.kind == "LayerKind.TEXT") return;
  if(options.ignoreHiddenLayers && layerVisibility[layer]  == false) return ;
  var actDoc = app.activeDocument;
  layer.copy();
  function newMode(mode) {
    switch(mode) {
      case DocumentMode.BITMAP:
        return NewDocumentMode.BITMAP;
      case DocumentMode.CMYK:
        return NewDocumentMode.CMYK;
      case DocumentMode.GRAYSCALE:
        return NewDocumentMode.GRAYSCALE;
      case DocumentMode.LAB:
        return NewDocumentMode.LAB;
      case DocumentMode.RGB:
      default:
        return NewDocumentMode.RGB;
    }
  }
  
  var colorProfileName 
  if(actDoc.colorProfileType == ColorProfile.CUSTOM || actDoc.colorProfileType == ColorProfile.WORKING) colorProfileName = actDoc.colorProfileName;
  
  var tmpDoc = app.documents.add(
                actDoc.width,
                actDoc.htight,
                actDoc.resolution,
                "EXPORT TMP PNG",
                newMode(actDoc.mode),
                DocumentFill.TRANSPARENT,
                actDoc.pixelAspectRatio,
                actDoc.bitsPerChannel,
                colorProfileName
                );
  tmpDoc.paste();
  tmpDoc.trim(TrimType.TRANSPARENT);
  
  var file = File(exportPath + "/texture/" + layer.name);
  if(file.exists) file.remove();
  var saveOp = new PNGSaveOptions();
  saveOp.compression = 9;//max compression
  tmpDoc.saveAs(file,saveOp,true);
  tmpDoc.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = actDoc;
}

//-----------------help function-------------
function makeIndent(deepth){
  var str = '';
  const TAB = '    ';
  for(var i = 0; i < deepth; ++i)
    str += TAB;
  return str;
}

function replace(str) {
  str = str.replace(/(\s*)&/g, '');
  var res = str.match(/^[0-9]+/);
	while(res && res.length > 0) {
		var sub = res.pop();
		str = str.replace(sub, '_'+sub);// 13days -> _13days
	}
  str = str.replace(/(^[^A-Za-z_])|(\W)/g, '_');
  var pos = -1;
  while( (pos = str.search(/(_+.+)/g)) != -1) {
    str = str.replace('_'+ str.charAt(pos + 1), 
                      str.charAt(pos + 1).toUpperCase());// _a -> _A
  }
  return str;
}

function stepHistoryBack(){
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putEnumerated(charIDToTypeID("HstS"), 
                    charIDToTypeID("Ordn"),
                    charIDToTypeID("Prvs"));
  desc.putReference(charIDToTypeID("null"), ref);
  executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);
}

function getPosAndWH(layer){
  var b = layer.bounds;
  return {
    x : Math.ceil(b[0].as("px")),
    y : Math.ceil(b[1].as("px")),
    w : Math.ceil(b[2].as("px") - b[0].as("px")),
    h : Math.ceil(b[3].as("px") - b[1].as("px")),
  }
}

function getLayerVisiable(layer){
  var bool = layer.visible;
  var obj = layer;
  while(obj.parent && obj.parent.hasOwnProperty("visible")) {
    bool = bool && obj.parent.visible;
    obj = obj.parent;
  }
  return bool;
}

function getLayers(layer, usedLayers){
  if(!layer.layers || layer.layers.length == 0) {
    if(layer.typename != 'LayerSet') 
      return layer;
    return null;
  }
  var len = layer.layers.length;
  for(var i = 0; i < len ;++i) {
    var child = getLayers(layer.layers[i], usedLayers);
    if(child) usedLayers.push(child);
  }
}

function isPsdSaved(){
  var ref = new ActionReference();
  ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
  return executeActionGet(ref).hasKey(stringIDToTypeID("fileReference"));
}

function close(wnd){
  wnd.close(0);
} 
