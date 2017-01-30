playerElement = document.querySelector('.player');

var myAudio = document.querySelector('audio');

function Player ( el ) {
  this.ac = new ( window.AudioContext || webkitAudioContext )();
  this.bindEvents();
  this.decode(myAudio);
}

Player.prototype.bindEvents = function() {
  window.addEventListener('click', this.click.bind(this));
};

Player.prototype.decode = function( myAudio ) {
    this.audio = myAudio;
    this.source = this.ac.createMediaElementSource(myAudio);
    this.analyser = this.ac.createAnalyser();
    this.source.connect(this.analyser);
    this.source.connect(this.ac.destination);
    this.analyser.fftSize = 4096*2;
    this.bufferLength = this.analyser.frequencyBinCount;

    this.byteFrequencyDataArray = new Uint8Array(this.analyser.fftSize);
    this.timeDomainDataArray = new Uint8Array(this.analyser.fftSize);

    this.play();
};

Player.prototype.connect = function() {
  if ( this.playing ) {
    this.pause();
  }
  else{
    this.audio.play();
  }
};

Player.prototype.play = function( position ) {
  this.connect();
  this.position = typeof position === 'number' ? position : this.position || 0;
  this.startTime = this.ac.currentTime - ( this.position || 0 );
  this.audio.play();

  this.playing = true;
};

Player.prototype.pause = function() {
  if ( this.source ) {
    this.audio.pause();
    this.position = this.ac.currentTime - this.startTime;
    this.playing = false;
  }
};

Player.prototype.seek = function( time ) {
  if ( this.playing ) {
    this.play(time);
  }
  else {
    this.position = time;
  }
};

Player.prototype.updatePosition = function() {
  if(!this.source)
  return 0;
  this.position = this.playing ?
  this.ac.currentTime - this.startTime : this.position;
  if ( this.position >= this.source.duration ) {
    this.position = this.source.duration;
    this.pause();
  }
  return this.position;
};

Player.prototype.toggle = function() {
  if ( !this.playing ) {
    this.play();
  }
  else {
    this.pause();
  }
};
Player.prototype.click = function(){
  this.toggle();
}

Player.prototype.onMouseDown = function( e ) {
};

Player.prototype.onDrag = function( e ) {
};

Player.prototype.onMouseUp = function() {
};


window.player = new Player(playerElement);

window.addEventListener('load', init, false);
function init() {
  try {
    // Fix up for prefixing
    window.AudioContext = window.AudioContext||window.webkitAudioContext;
    //context = new AudioContext();
  }
  catch(e) {
    alert('Web Audio API is not supported in this browser');
  }
}
// Webkit/blink browsers need prefix, Safari won't work without window.
window.requestAnimationFrame = window.requestAnimationFrame || ( function() {

  return  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  function(  callback, element ) {
    window.setTimeout( callback, 1000 / 60 );
  };

})();

var canvas,
gl,
buffer,
vertex_shader, fragment_shader,
currentProgram,
vertex_position,
timeLocation,
audioTexture,
resolutionLocation,
audioTextureLocation,
parameters = {
  start_time:   new Date().getTime(),
  time:         0,
  screenWidth:  0,
  screenHeight: 0,
};

  init();
  animate();

  function init() {

    vertex_shader = document.getElementById('vs').textContent;
    fragment_shader = document.getElementById('fs').textContent;

    canvas = document.querySelector( 'canvas' );
    // Initialise WebGL
    try {
      gl = canvas.getContext( 'experimental-webgl' );
    } catch( error ) { }
    if ( !gl ) {
      throw "cannot create webgl context";
    }

    // Create Vertex buffer (2 triangles)

    buffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ - 1.0, - 1.0, 1.0, - 1.0, - 1.0, 1.0, 1.0, - 1.0, 1.0, 1.0, - 1.0, 1.0 ] ), gl.STATIC_DRAW );

    // Create Program
    currentProgram = createProgram( vertex_shader, fragment_shader );
    timeLocation = gl.getUniformLocation( currentProgram, 'time' );
    resolutionLocation = gl.getUniformLocation( currentProgram, 'resolution' );
    audioTextureLocation = gl.getUniformLocation( currentProgram, 'audio' );
  }

  function createAudioTexture(){
    if(!this.player.bufferLength){
      return null;
    }
    this.player.analyser.getByteFrequencyData(this.player.byteFrequencyDataArray);
    this.player.analyser.getByteTimeDomainData(this.player.timeDomainDataArray);


    const bfd = this.player.byteFrequencyDataArray;
    const tdd = this.player.timeDomainDataArray;

    let totalLength = bfd.length + tdd.length;
    let res = new Uint8Array(totalLength);
    res.set(tdd);
    res.set(bfd, tdd.length);
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, totalLength/2, 2, 0, gl.ALPHA, gl.UNSIGNED_BYTE, res);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    return texture;
  }

  function createProgram( vertex, fragment ) {

    var program = gl.createProgram();
    var vs = createShader( vertex, gl.VERTEX_SHADER );
    var fs = createShader( '#ifdef GL_ES\nprecision highp float;\n#endif\n\n' + fragment, gl.FRAGMENT_SHADER );
    if ( vs == null || fs == null ) return null;
    gl.attachShader( program, vs );
    gl.attachShader( program, fs );
    gl.deleteShader( vs );
    gl.deleteShader( fs );
    gl.linkProgram( program );
    if ( !gl.getProgramParameter( program, gl.LINK_STATUS ) ) {
      alert( "ERROR:\n" +
      "VALIDATE_STATUS: " + gl.getProgramParameter( program, gl.VALIDATE_STATUS ) + "\n" +
      "ERROR: " + gl.getError() + "\n\n" +
      "- Vertex Shader -\n" + vertex + "\n\n" +
      "- Fragment Shader -\n" + fragment );
      return null;
    }
    return program;
  }

  function createShader( src, type ) {
    var shader = gl.createShader( type );
    gl.shaderSource( shader, src );
    gl.compileShader( shader );
    if ( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {
      alert( ( type == gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT" ) + " SHADER:\n" + gl.getShaderInfoLog( shader ) );
      return null;
    }
    return shader;
  }

  function resizeCanvas( event ) {
    if ( canvas.width != canvas.clientWidth ||
      canvas.height != canvas.clientHeight ) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        parameters.screenWidth = canvas.width;
        parameters.screenHeight = canvas.height;
        gl.viewport( 0, 0, canvas.width, canvas.height );
      }
    }

    function animate() {
      resizeCanvas();
      render();
      requestAnimationFrame( animate );
    }

    function render() {
      this.player.updatePosition();
      if ( !currentProgram ) return;
      parameters.time = window.player.position;
      gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
      // Load program into GPU
      gl.useProgram( currentProgram );
      // Set values to program variables
      gl.uniform1f( timeLocation, parameters.time );
      gl.uniform2f( resolutionLocation, parameters.screenWidth, parameters.screenHeight );
      let audioTexture = this.createAudioTexture();
      gl.uniform1i(audioTextureLocation, audioTexture);
      // Render geometry
      gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
      gl.vertexAttribPointer( vertex_position, 2, gl.FLOAT, false, 0, 0 );
      gl.enableVertexAttribArray( vertex_position );
      gl.drawArrays( gl.TRIANGLES, 0, 6 );
      gl.disableVertexAttribArray( vertex_position );
    }
