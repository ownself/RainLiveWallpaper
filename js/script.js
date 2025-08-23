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
let isFolderMode = false; // 标记是否处于文件夹模式
let isVideoLoop = true;
let currentVideoElement = null; // 当前播放的视频元素
// 用于不重复随机遍历的索引数组
let imageIndices = []; // 图片文件的索引数组
let videoIndices = []; // 视频文件的索引数组
let currentImageIndex = 0; // 当前图片索引位置 (用于单图模式或三图模式首次加载)
let currentVideoIndex = 0; // 当前视频索引位置

// 三图模式特有变量
let isTripleImageMode = false; // 标记是否处于三图模式 (基于图片数量)
let tripleImageIndices = [0, 1, 2]; // 当前在屏幕上显示的三张图片的索引 (相对于imageIndices)
let nextTripleImageSlot = 0; // 下一个要替换的图片槽位 (0, 1, 2)

// --- 新增：用于独立定时器管理 ---
let imageChangeTimers = {}; // 存储每个图片槽位的定时器ID {0: id, 1: id, 2: id}
let videoChangeTimer = null;   // 存储视频切换的定时器ID
// --- 新增结束 ---

let scene, camera, renderer, material;
let settings = { fps: 30, scale: 1.0, parallaxVal: 0 };
let slideShowInterval = 4; // 幻灯片间隔时间（秒）
let videoElement;

// --- 过渡效果 ---
let fadeTransition; // 淡入淡出过渡效果实例
// --- 过渡效果结束 ---

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
      u_tex1: { type: "t" },
      u_tex2: { type: "t" },
      u_time: { value: 0, type: "f" },
      u_intensity: { value: 0.4, type: "f" },
      u_speed: { value: 0.25, type: "f" },
      u_brightness: { value: 1.0, type: "f" },
      u_normal: { value: 0.5, type: "f" },
      u_zoom: { value: 2.61, type: "f" },
      u_blur_intensity: { value: 0.0, type: "f" },
      u_blur_iterations: { value: 1, type: "i" },
      u_panning: { value: false, type: "b" },
      u_post_processing: { value: false, type: "b" },
      u_lightning: { value: false, type: "b" },
      u_texture_fill: { value: false, type: "b" },
      u_rain_enabled: { value: false, type: "b" },
      u_triple_image_mode: { value: true, type: "b" }, // New uniform for triple image mode, default to true for debugging
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
      u_tex0_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
      u_tex1_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
      u_tex2_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
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

  // --- 修改：尝试从 list.json 加载图片和视频列表 ---
  let autoLoaded = false;
  try {
    console.log("Attempting to load media list from ./media/list.json");
    const response = await fetch('media/list.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const mediaFiles = await response.json();
    console.log("Loaded media list:", mediaFiles);

    if (Array.isArray(mediaFiles) && mediaFiles.length > 0) {
      // Filter for image and video files (basic check)
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
      const videoExtensions = ['.mp4', '.webm', '.ogg']; // Add common video extensions
      const mediaUrls = mediaFiles.map(file => `media/${file}`); // Prepend 'media/' to form full relative path

      // Separate images and videos
      const imageUrls = mediaUrls.filter(url => {
        const lowerUrl = url.toLowerCase();
        return imageExtensions.some(ext => lowerUrl.endsWith(ext));
      });

      const videoUrls = mediaUrls.filter(url => {
        const lowerUrl = url.toLowerCase();
        return videoExtensions.some(ext => lowerUrl.endsWith(ext));
      });

      if (imageUrls.length > 0 || videoUrls.length > 0) {
        console.log("Auto-starting folder mode with media from list.json");
        // Pass both images and videos
        await processFolderPaths([...imageUrls, ...videoUrls]);
        autoLoaded = true;
      } else {
        console.warn("No valid image or video files found in the list.json");
      }
    } else {
      console.warn("media/list.json is empty or not an array");
    }
  } catch (error) {
    console.log("Could not load media/list.json for auto folder mode, or list is empty/invalid:", error.message);
  }

  // 如果没有从 list.json 自动加载，则加载默认图片
  if (!autoLoaded) {
    material.uniforms.u_tex0_resolution.value = new THREE.Vector2(1920, 1080);
    material.uniforms.u_tex0.value = await new THREE.TextureLoader().loadAsync("media/image.webp");
  }
  // --- 修改结束 ---

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), material);
  scene.add(quad);

  window.addEventListener("resize", (e) => resize());
  render();
  datUI();

  // 初始化过渡效果
  fadeTransition = new FadeTransition(scene, camera, renderer, material);

  document.dispatchEvent(sceneLoadedEvent);
}

// --- 新增：处理文件夹选择 ---
document.getElementById("folderPicker").addEventListener("change", function (event) {
  if (event.target.files.length === 0) return;

  // Convert FileList to Array and pass to processFolderPaths
  const files = Array.from(event.target.files);
  // 筛选出图片文件和视频文件
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  const videoFiles = files.filter(file => file.type.startsWith('video/'));

  // 判断文件夹模式 - 统一处理图片和视频
  if (imageFiles.length > 0 || videoFiles.length > 0) {
    // 清空之前的列表和定时器
    backgroundImages = [];
    backgroundVideos = [];
    // 清理当前视频元素
    if (currentVideoElement) {
      disposeVideoElement(currentVideoElement);
      currentVideoElement = null;
    }

    // Reset triple image mode specific variables
    isTripleImageMode = false;
    tripleImageIndices = [0, 1, 2];
    nextTripleImageSlot = 0;

    isFolderMode = true; // 进入文件夹模式

    // 合并图片和视频文件
    const allMediaFiles = [...imageFiles, ...videoFiles];

    // 使用新的处理函数
    processFolderPaths(allMediaFiles); // Pass the File objects directly
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
        material.uniforms.u_tex1.value?.dispose();
        material.uniforms.u_tex2.value?.dispose();
        if (ext == "jpg" || ext == "jpeg" || ext == "png") {
          new THREE.TextureLoader().load(val, function (tex) {
            material.uniforms.u_tex0.value = tex;
            material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
            // When selecting a single image, disable triple mode
            material.uniforms.u_triple_image_mode.value = false;
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
          // When selecting a video, disable triple mode
          material.uniforms.u_triple_image_mode.value = false;
        }
      }
      break;
    case "mediaScaling":
      material.uniforms.u_texture_fill.value = [false, true][val];
      break;
    case "slideShowInterval":
      slideShowInterval = val;
      // 如果当前正在运行幻灯片，重新设置定时器
      if (isFolderMode) {
        // 清除所有图片定时器
        Object.values(imageChangeTimers).forEach(id => clearTimeout(id));
        imageChangeTimers = {};
        // 清除视频定时器
        // if (videoChangeTimer) { // Assuming videoChangeTimer is not used anymore
        //     clearTimeout(videoChangeTimer);
        //     videoChangeTimer = null;
        // }
        // 立即切换到下一张图片/视频 或 重新设置独立定时器
        if (isTripleImageMode) {
            // 重新设置独立定时器
            if (typeof window.setupIndependentImageTimers === 'function') {
                window.setupIndependentImageTimers();
            } else {
                 console.error("setupIndependentImageTimers function is not available in livelyPropertyListener::slideShowInterval");
            }
        } else {
            // 对于单图模式，立即切换并设置新的定时器
            changeBackgroundToNextImage();
        }
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
    case "tripleImageMode":
      material.uniforms.u_triple_image_mode.value = val;
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

  // Add Triple Image Mode toggle (for manual override, though it's auto-managed)
  bg.add(material.uniforms.u_triple_image_mode, "value").name("Triple Image Mode").listen();

  // Update the initial value of u_triple_image_mode based on the number of images
  // This will be overridden when a folder is selected, but good for initial state
  if (backgroundImages && backgroundImages.length >= 3) {
    material.uniforms.u_triple_image_mode.value = true;
    isTripleImageMode = true; // Sync internal state
  } else {
    material.uniforms.u_triple_image_mode.value = false;
    isTripleImageMode = false; // Sync internal state
  }
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
      if (isFolderMode) {
        // 清除所有图片定时器
        Object.values(imageChangeTimers).forEach(id => clearTimeout(id));
        imageChangeTimers = {};
        // 清除视频定时器
        // if (videoChangeTimer) { // Assuming videoChangeTimer is not used anymore
        //     clearTimeout(videoChangeTimer);
        //     videoChangeTimer = null;
        // }
        // 立即切换到下一张图片/视频 或 重新设置独立定时器
        if (isTripleImageMode) {
            // 重新设置独立定时器
            if (typeof window.setupIndependentImageTimers === 'function') {
                window.setupIndependentImageTimers();
            } else {
                 console.error("setupIndependentImageTimers function is not available in bg.add::slideShowIntervalSetting::onChange");
            }
        } else {
            // 对于单图模式，立即切换并设置新的定时器
            changeBackgroundToNextImage();
        }
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
    material.uniforms.u_tex1.value?.dispose();
    material.uniforms.u_tex2.value?.dispose();

    new THREE.TextureLoader().load(URL.createObjectURL(file), function (tex) {
      material.uniforms.u_tex0.value = tex;
      material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
      // When selecting a single image, disable triple mode
      material.uniforms.u_triple_image_mode.value = false;
    });
  } else if (file.type == "video/mp4" || file.type == "video/webm") {
    disposeVideoElement(videoElement);
    material.uniforms.u_tex0.value?.dispose();
    material.uniforms.u_tex1.value?.dispose();
    material.uniforms.u_tex2.value?.dispose();

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
    // When selecting a video, disable triple mode
    material.uniforms.u_triple_image_mode.value = false;
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
  // --- 修复：增加对 null/undefined 和非字符串的检查 ---
  if (typeof filePath !== 'string' || filePath.length === 0) {
    console.warn("[getExtension] Invalid filePath provided:", filePath);
    return ''; // Return empty string for invalid input
  }
  // --- 修复结束 ---
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

// --- 新增：初始化并打乱索引数组 ---
function initializeAndShuffleIndices(indicesArray, length) {
  // 初始化索引数组
  indicesArray.length = 0;
  for (let i = 0; i < length; i++) {
    indicesArray.push(i);
  }

  // Fisher-Yates 洗牌算法打乱数组
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indicesArray[i], indicesArray[j]] = [indicesArray[j], indicesArray[i]];
  }
}

// --- 新增：处理文件夹路径列表的函数 ---
async function processFolderPaths(mediaUrls) {
  if (mediaUrls.length === 0) return Promise.resolve();

  // Clear previous state
  backgroundImages = [];
  backgroundVideos = [];
  // 清除所有图片定时器
  Object.values(imageChangeTimers).forEach(id => clearTimeout(id));
  imageChangeTimers = {};
  // 清除视频定时器
  if (videoChangeTimer) {
    clearTimeout(videoChangeTimer);
    videoChangeTimer = null;
  }
  if (currentVideoElement) {
    disposeVideoElement(currentVideoElement);
    currentVideoElement = null;
  }

  // Reset triple image mode specific variables
  isTripleImageMode = false;
  tripleImageIndices = [0, 1, 2];
  nextTripleImageSlot = 0;

  isFolderMode = true; // Enter folder mode

  // Store the URLs directly
  backgroundImages = mediaUrls;

  console.log(`Loaded ${backgroundImages.length} media files from list.`);

  // Initialize and shuffle image indices
  initializeAndShuffleIndices(imageIndices, backgroundImages.length);
  currentImageIndex = 0;

  // Determine if triple image mode should be enabled
  isTripleImageMode = backgroundImages.length >= 3;
  material.uniforms.u_triple_image_mode.value = isTripleImageMode;

  // Reset triple image mode state
  if (isTripleImageMode) {
    tripleImageIndices = [imageIndices[0], imageIndices[1], imageIndices[2]];
    nextTripleImageSlot = 0;
    currentImageIndex = 3; // Next image to load will be the 4th one
  }

  // Immediately load the first set of images
  // Return a promise that resolves when the first image(s) are loaded
  return new Promise((resolve) => {
    const loadFirstImages = () => {
      if (isTripleImageMode) {
          loadInitialTripleImages();
      } else {
          changeBackgroundToNextImage(); // For single image mode
      }
      resolve();
    };

    // If in triple mode, wait for initial load to complete before setting interval
    // A simple way is to check if it's the first load in triple mode
    if (isTripleImageMode && nextTripleImageSlot === 0) {
      // We can use a flag or a more complex promise mechanism
      // For simplicity, we'll just call it directly, as the initial load logic handles it
      loadFirstImages();
    } else {
      loadFirstImages();
    }
  });
}
// --- 新增结束 ---

// These functions have been moved to loadInitialTripleImages.js and are now available on the window object.
// They are no longer needed in this file.
// - setupIndependentImageTimers
// - scheduleImageChangeForSlot
// - changeBackgroundForSlot
// - changeBackgroundToNextVideo (deprecated)

//ref: https://stackoverflow.com/questions/3258587/how-to-properly-unload-destroy-a-video-element
function disposeVideoElement(video) {
  if (video != null && video.hasAttribute("src")) {
    video.pause();
    video.removeAttribute("src"); // empty source
    video.load();
  }
}
