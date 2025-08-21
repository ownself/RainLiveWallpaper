const container = document.getElementById("container");
let clock = new THREE.Clock();
const gui = new dat.GUI();
let isPaused = false,
  elapsedResetTime = 21600,
  elapsedPreviousTime = 0;
let devicePixelRatio = window.devicePixelRatio || 1;
// --- 新增变量 ---
let backgroundImages = []; // 存储从文件夹读取的图片文件对象
let backgroundVideos = []; // 存储从文件夹读取的视频文件对象
let backgroundChangeIntervalId = null; // 存储定时器ID
let isFolderMode = false; // 标记是否处于文件夹轮播模式
let isVideoFolderMode = false; // 标记是否处于视频文件夹模式
let isVideoLoop = true;
let currentVideoElement = null; // 当前播放的视频元素
// --- 新增结束 ---

let scene, camera, renderer, material;
let settings = { fps: 30, scale: 1.0, parallaxVal: 0 };
let slideShowInterval = 10; // 幻灯片间隔时间（秒）
let videoElement;

//custom events
const sceneLoadedEvent = new Event("sceneLoaded");

async function init() {
  renderer = new THREE.WebGLRenderer({
    antialias: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(settings.scale * devicePixelRatio);
  container.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  material = new THREE.ShaderMaterial({
    uniforms: {
      u_tex0: { type: "t" },
      u_time: { value: 0, type: "f" },
      u_intensity: { value: 0.4, type: "f" },
      u_speed: { value: 0.25, type: "f" },
      u_brightness: { value: 0.8, type: "f" },
      u_normal: { value: 0.5, type: "f" },
      u_zoom: { value: 2.61, type: "f" },
      u_blur_intensity: { value: 0.0, type: "f" },
      u_blur_iterations: { value: 16, type: "i" },
      u_panning: { value: false, type: "b" },
      u_post_processing: { value: false, type: "b" },
      u_lightning: { value: false, type: "b" },
      u_texture_fill: { value: false, type: "b" },
      u_rain_enabled: { value: false, type: "b" },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
      u_tex0_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
    },
    vertexShader: `
          varying vec2 vUv;
          void main() {
              vUv = uv;
              gl_Position = vec4( position, 1.0 );
          }
        `,
  });
  material.fragmentShader = await (await fetch("shaders/rain.frag")).text();
  resize();

  material.uniforms.u_tex0_resolution.value = new THREE.Vector2(1920, 1080);
  material.uniforms.u_tex0.value = await new THREE.TextureLoader().loadAsync("media/image.webp");

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), material);
  scene.add(quad);

  window.addEventListener("resize", (e) => resize());
  render();
  datUI();

  document.dispatchEvent(sceneLoadedEvent);
}

// --- 新增：处理文件夹选择 ---
document.getElementById("folderPicker").addEventListener("change", function (event) {
  if (event.target.files.length === 0) return;
  // 清空之前的列表和定时器
  backgroundImages = [];
  backgroundVideos = [];
  if (backgroundChangeIntervalId) {
    clearInterval(backgroundChangeIntervalId);
    backgroundChangeIntervalId = null;
  }
  // 清理当前视频元素
  if (currentVideoElement) {
    disposeVideoElement(currentVideoElement);
    currentVideoElement = null;
  }

  isFolderMode = true; // 进入文件夹模式
  isVideoFolderMode = false; // 默认不是视频文件夹模式

  const files = Array.from(event.target.files);
  // 筛选出图片文件和视频文件
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  const videoFiles = files.filter(file => file.type.startsWith('video/'));

  // 判断文件夹模式
  if (videoFiles.length > 0) {
    // 如果存在视频文件，进入视频文件夹模式
    isVideoFolderMode = true;
    backgroundVideos = videoFiles;
    if (videoFiles.length > 1) {
        isVideoLoop = false; // disable looping if multiple videos are present
    } else {
        isVideoLoop = true; // enable looping if only one video is present
    }

    if (backgroundVideos.length === 0) {
      console.warn("No video files found in the selected folder.");
      return;
    }
    console.log(`Loaded ${backgroundVideos.length} videos from folder.`);
    // 立即加载第一个视频
    changeBackgroundToRandomVideo();
  } else if (imageFiles.length > 0) {
    // 如果只有图片文件，进入图片文件夹模式
    backgroundImages = imageFiles;

    if (backgroundImages.length === 0) {
      console.warn("No image files found in the selected folder.");
      return;
    }
    console.log(`Loaded ${backgroundImages.length} images from folder.`);
    // 立即加载第一张图片
    changeBackgroundToRandomImage();

    // 设置定时器，根据配置的时间间隔更换图片
    backgroundChangeIntervalId = setInterval(changeBackgroundToRandomImage, slideShowInterval * 1000);
  } else {
    console.warn("No image or video files found in the selected folder.");
    return;
  }
});

function setScale(userScale) {
  settings.scale = userScale;
  const finalScale = devicePixelRatio * settings.scale;
  if (renderer.getPixelRatio() == finalScale)
    return;

  renderer.setPixelRatio(finalScale);
  material.uniforms.u_resolution.value = new THREE.Vector2(
    window.innerWidth * finalScale,
    window.innerHeight * finalScale
  );
}

function resize() {
  if (window.devicePixelRatio !== devicePixelRatio) {
    devicePixelRatio = window.devicePixelRatio || 1;
    setScale(settings.scale);
  }
  const finalScale = devicePixelRatio * settings.scale;

  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.u_resolution.value = new THREE.Vector2(
    window.innerWidth * finalScale,
    window.innerHeight * finalScale
  );
}

function render() {
  setTimeout(function () {
    requestAnimationFrame(render);
  }, 1000 / settings.fps);

  //reset every 6hr
  if (clock.getElapsedTime() > elapsedResetTime) clock = new THREE.Clock();
  material.uniforms.u_time.value = clock.getElapsedTime();

  renderer.render(scene, camera);
}

function livelyWallpaperPlaybackChanged(data) {
  var obj = JSON.parse(data);
  isPaused = obj.IsPaused;

  if (isPaused) {
    elapsedPreviousTime = clock.getElapsedTime();
    elapsedPreviousTime = elapsedPreviousTime > elapsedResetTime ? 0 : elapsedPreviousTime;
    clock.stop();
  } else {
    clock.start();
    clock.elapsedTime = elapsedPreviousTime;
  }
}

init();

//lively api
//docs: https://github.com/rocksdanister/lively/wiki/Web-Guide-IV-:-Interaction
function livelyPropertyListener(name, val) {
  switch (name) {
    case "blurIntensity":
      material.uniforms.u_blur_intensity.value = val / 100;
      break;
    case "blurQuality":
      material.uniforms.u_blur_iterations.value = [1, 16, 32, 64][val];
      break;
    case "rainIntensity":
      material.uniforms.u_intensity.value = val / 100;
      break;
    case "rainSpeed":
      material.uniforms.u_speed.value = val / 100;
      break;
    case "brightness":
      material.uniforms.u_brightness.value = val / 100;
      break;
    case "rainNormal":
      material.uniforms.u_normal.value = val / 100;
      break;
    case "rainZoom":
      material.uniforms.u_zoom.value = val / 100;
      break;
    case "mediaSelect":
      {
        let ext = getExtension(val);
        disposeVideoElement(videoElement);
        material.uniforms.u_tex0.value?.dispose();
        if (ext == "jpg" || ext == "jpeg" || ext == "png") {
          new THREE.TextureLoader().load(val, function (tex) {
            material.uniforms.u_tex0.value = tex;
            material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
          });
        } else if (ext == "webm") {
          videoElement = createVideoElement(val);
          let videoTexture = new THREE.VideoTexture(videoElement);
          videoElement.addEventListener(
            "loadedmetadata",
            function (e) {
              material.uniforms.u_tex0_resolution.value = new THREE.Vector2(
                videoTexture.image.videoWidth,
                videoTexture.image.videoHeight
              );
            },
            false
          );
          material.uniforms.u_tex0.value = videoTexture;
        }
      }
      break;
    case "mediaScaling":
      material.uniforms.u_texture_fill.value = [false, true][val];
      break;
    case "slideShowInterval":
      slideShowInterval = val;
      // 如果当前正在运行幻灯片，重新设置定时器
      if (isFolderMode && backgroundChangeIntervalId) {
        clearInterval(backgroundChangeIntervalId);
        backgroundChangeIntervalId = setInterval(changeBackgroundToRandomImage, slideShowInterval * 1000);
      }
      break;
    case "rainEnabled":
      material.uniforms.u_rain_enabled.value = val;
      break;
    case "animateChk":
      material.uniforms.u_panning.value = val;
      break;
    case "lightningChk":
      material.uniforms.u_lightning.value = val;
      break;
    case "postProcessingChk":
      material.uniforms.u_post_processing.value = val;
      break;
    case "parallaxIntensity":
      settings.parallaxVal = val;
      break;
    case "fpsLock":
      settings.fps = val ? 30 : 60;
      break;
    case "displayScaling":
      setScale(val);
      break;
    case "debug":
      if (val) gui.show();
      else gui.hide();
      break;
  }
}

//web
function datUI() {
  let rain = gui.addFolder("Rain");
  let bg = gui.addFolder("Background");
  let perf = gui.addFolder("Performance");
  let misc = gui.addFolder("More");
  rain.open();
  bg.open();
  perf.open();
  misc.open();
  rain.add(material.uniforms.u_intensity, "value", 0, 1, 0.01).name("Intensity");
  rain.add(material.uniforms.u_speed, "value", 0, 10, 0.01).name("Speed");
  rain.add(material.uniforms.u_brightness, "value", 0, 1, 0.01).name("Brightness");
  rain.add(material.uniforms.u_normal, "value", 0, 3, 0.01).name("Normal");
  rain.add(material.uniforms.u_zoom, "value", 0.1, 3.0, 0.01).name("Zoom");
  rain.add(material.uniforms.u_lightning, "value").name("Lightning");
  rain.add(material.uniforms.u_rain_enabled, "value").name("Enable Rain");
  bg.add(
    {
      picker: function () {
        document.getElementById("filePicker").click();
      },
    },
    "picker"
  ).name("Change Background");

  // --- 新增：添加“Change Background Folder”按钮 ---
  bg.add(
    {
      folderPicker: function () {
        document.getElementById("folderPicker").click();
      },
    },
    "folderPicker"
  ).name("Change Background Folder");
  // --- 新增结束 ---
  bg.add(material.uniforms.u_blur_iterations, "value", 1, 64, 1).name("Blur Quality");
  bg.add(material.uniforms.u_blur_intensity, "value", 0, 10, 0.01).name("Blur");
  bg.add(settings, "parallaxVal", 0, 5, 1).name("Parallax");
  bg.add(material.uniforms.u_texture_fill, "value").name("Scale to Fill");
  // 添加幻灯片间隔滑块
  let slideShowIntervalSetting = { value: slideShowInterval };
  bg.add(slideShowIntervalSetting, "value", 5, 1200, 1)
    .name("Slide Show Interval (seconds)")
    .onChange(function (val) {
      slideShowInterval = val;
      // 如果当前正在运行幻灯片，重新设置定时器
      if (isFolderMode && backgroundChangeIntervalId) {
        clearInterval(backgroundChangeIntervalId);
        backgroundChangeIntervalId = setInterval(changeBackgroundToRandomImage, slideShowInterval * 1000);
      }
      // 通知Lively属性变更
      if (typeof livelyPropertyListener === 'function') {
        // 这里我们不直接调用livelyPropertyListener，因为这是UI变化，不是来自Lively的属性变更
      }
    });
  bg.add(material.uniforms.u_panning, "value").name("Panning");
  bg.add(material.uniforms.u_post_processing, "value").name("Post Processing");
  perf.add(settings, "fps", 15, 120, 15).name("FPS");
  let tempScale = { value: settings.scale }; //don't update global value
  perf
    .add(tempScale, "value", 0.1, 2, 0.01)
    .name("Scale")
    .onChange(function () {
      setScale(tempScale.value);
    });
  misc
    .add(
      {
        lively: function () {
          window.open("https://www.rocksdanister.com/lively");
        },
      },
      "lively"
    )
    .name("Try It On Your Desktop!");
  misc
    .add(
      {
        source: function () {
          window.open("https://github.com/rocksdanister/rain");
        },
      },
      "source"
    )
    .name("Source Code");
  gui.close();
}

document.getElementById("filePicker").addEventListener("change", function () {
  if (this.files[0] === undefined) return;
  let file = this.files[0];
  if (file.type == "image/jpg" || file.type == "image/jpeg" || file.type == "image/png") {
    disposeVideoElement(videoElement);
    material.uniforms.u_tex0.value?.dispose();

    new THREE.TextureLoader().load(URL.createObjectURL(file), function (tex) {
      material.uniforms.u_tex0.value = tex;
      material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
    });
  } else if (file.type == "video/mp4" || file.type == "video/webm") {
    disposeVideoElement(videoElement);
    material.uniforms.u_tex0.value?.dispose();

    videoElement = createVideoElement(URL.createObjectURL(file));
    let videoTexture = new THREE.VideoTexture(videoElement);
    videoElement.addEventListener(
      "loadedmetadata",
      function (e) {
        material.uniforms.u_tex0_resolution.value = new THREE.Vector2(
          videoTexture.image.videoWidth,
          videoTexture.image.videoHeight
        );
      },
      false
    );
    material.uniforms.u_tex0.value = videoTexture;
  }
});

//parallax
document.addEventListener("mousemove", function (event) {
  if (settings.parallaxVal == 0) return;

  const x = (window.innerWidth - event.pageX * settings.parallaxVal) / 90;
  const y = (window.innerHeight - event.pageY * settings.parallaxVal) / 90;

  container.style.transform = `translateX(${x}px) translateY(${y}px) scale(1.09)`;
});

//helpers
function getExtension(filePath) {
  return filePath.substring(filePath.lastIndexOf(".") + 1, filePath.length).toLowerCase() || filePath;
}

function createVideoElement(src, looping = true) {
  let htmlVideo = document.createElement("video");
  htmlVideo.src = src;
  htmlVideo.muted = true;
  htmlVideo.loop = looping; // 默认循环播放
  htmlVideo.play();
  return htmlVideo;
}

// --- 新增：随机更换背景图片的函数 ---
function changeBackgroundToRandomImage() {
  if (!isFolderMode || isVideoFolderMode || backgroundImages.length === 0) { // 如果不是文件夹模式、是视频模式或者没有图片，则不执行
    return;
  }
  const randomIndex = Math.floor(Math.random() * backgroundImages.length);
  const randomImageFile = backgroundImages[randomIndex];
  console.log(`Changing background to: ${randomImageFile.name}`);
  // 重用现有的单张图片加载逻辑，但使用 File 对象
  disposeVideoElement(videoElement); // 如果之前有视频，先清理
  material.uniforms.u_tex0.value?.dispose(); // 清理旧纹理

  // 使用 File 对象创建对象 URL 并加载
  new THREE.TextureLoader().load(URL.createObjectURL(randomImageFile), function (tex) {
    material.uniforms.u_tex0.value = tex;
    // 注意：File 对象没有直接的 width/height 属性，需要通过 Image 对象获取
    // 或者使用 tex.image.naturalWidth/Height (在纹理加载完成后)
    // 这里简单处理，可能需要更精确的尺寸同步（对于 u_tex0_resolution）
    // 一个更稳健的方法是在纹理加载的 onLoad 回调中设置尺寸
    //但通常 texture.image 会包含加载后的 HTMLImageElement，其 width/height 可用
    // 为简化，我们假设它有效（在大多数浏览器中是这样）
    material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
  });
}
// --- 新增结束 ---

// --- 新增：随机播放背景视频的函数 ---
function changeBackgroundToRandomVideo() {
  if (!isFolderMode || !isVideoFolderMode || backgroundVideos.length === 0) { // 如果不是文件夹模式、不是视频模式或者没有视频，则不执行
    return;
  }

  const randomIndex = Math.floor(Math.random() * backgroundVideos.length);
  const randomVideoFile = backgroundVideos[randomIndex];
  console.log(`Changing background to video: ${randomVideoFile.name}`);

  // 清理之前的视频元素
  if (currentVideoElement) {
    disposeVideoElement(currentVideoElement);
  }

  // 清理旧纹理
  material.uniforms.u_tex0.value?.dispose();

  // 创建新的视频元素
  currentVideoElement = createVideoElement(URL.createObjectURL(randomVideoFile), isVideoLoop);

  // 添加播放结束事件监听器
  currentVideoElement.addEventListener('ended', function() {
    console.log('Video ended, switching to next video');
    changeBackgroundToRandomVideo(); // 播放下一个随机视频
  });

  // 创建视频纹理
  let videoTexture = new THREE.VideoTexture(currentVideoElement);
  currentVideoElement.addEventListener(
    "loadedmetadata",
    function (e) {
      material.uniforms.u_tex0_resolution.value = new THREE.Vector2(
        videoTexture.image.videoWidth,
        videoTexture.image.videoHeight
      );
    },
    false
  );
  material.uniforms.u_tex0.value = videoTexture;
}
// --- 新增结束 ---

//ref: https://stackoverflow.com/questions/3258587/how-to-properly-unload-destroy-a-video-element
function disposeVideoElement(video) {
  if (video != null && video.hasAttribute("src")) {
    video.pause();
    video.removeAttribute("src"); // empty source
    video.load();
  }
}
