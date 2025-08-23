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
// 用于不重复随机遍历的索引数组
let imageIndices = []; // 图片文件的索引数组
let videoIndices = []; // 视频文件的索引数组
let currentImageIndex = 0; // 当前图片索引位置 (用于单图模式或三图模式首次加载)
let currentVideoIndex = 0; // 当前视频索引位置

// 三图模式特有变量
let isTripleImageMode = false; // 标记是否处于三图模式 (基于图片数量)
let tripleImageIndices = [0, 1, 2]; // 当前在屏幕上显示的三张图片的索引 (相对于imageIndices)
let nextTripleImageSlot = 0; // 下一个要替换的图片槽位 (0, 1, 2)
// --- 新增结束 ---

let scene, camera, renderer, material;
let settings = { fps: 30, scale: 1.0, parallaxVal: 0 };
let slideShowInterval = 10; // 幻灯片间隔时间（秒）
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

  // --- 修改：尝试从 list.json 加载图片列表 ---
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
      // Filter for image files (basic check)
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
      const imageUrls = mediaFiles.filter(file => {
        const lowerFile = file.toLowerCase();
        return imageExtensions.some(ext => lowerFile.endsWith(ext));
      }).map(file => `media/${file}`); // Prepend 'media/' to form full relative path

      if (imageUrls.length > 0) {
        console.log("Auto-starting folder mode with images from list.json");
        await processFolderPaths(imageUrls); // Prepend 'media/' to form full relative path
        autoLoaded = true;
      } else {
        console.warn("No valid image files found in the list.json");
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

  // 判断文件夹模式
  if (videoFiles.length > 0) {
    // --- 视频逻辑保持不变 ---
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

    // Reset triple image mode specific variables
    isTripleImageMode = false;
    tripleImageIndices = [0, 1, 2];
    nextTripleImageSlot = 0;

    isFolderMode = true; // 进入文件夹模式
    isVideoFolderMode = true; // 是视频文件夹模式

    // 如果存在视频文件，进入视频文件夹模式
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

    // 初始化视频索引数组并打乱
    initializeAndShuffleIndices(videoIndices, backgroundVideos.length);
    currentVideoIndex = 0;

    // 立即加载第一个视频
    changeBackgroundToNextVideo();
    // --- 视频逻辑结束 ---
  } else if (imageFiles.length > 0) {
    // 如果只有图片文件，使用新的处理函数
    processFolderPaths(imageFiles); // Pass the File objects directly
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
      if (isFolderMode && backgroundChangeIntervalId) {
        changeBackgroundToNextImage();
        // Set up the timer for slideshow
        backgroundChangeIntervalId = setInterval(changeBackgroundToNextImage, slideShowInterval * 1000);
        resolve();
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
      if (isFolderMode && backgroundChangeIntervalId) {
        // clearInterval(backgroundChangeIntervalId);
        // backgroundChangeIntervalId = setInterval(changeBackgroundToRandomImage, slideShowInterval * 1000);
        changeBackgroundToNextImage();
        // Set up the timer for slideshow
        backgroundChangeIntervalId = setInterval(changeBackgroundToNextImage, slideShowInterval * 1000);
        resolve();
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
async function processFolderPaths(imageUrls) {
  if (imageUrls.length === 0) return Promise.resolve();

  // Clear previous state
  backgroundImages = [];
  backgroundVideos = [];
  if (backgroundChangeIntervalId) {
    clearInterval(backgroundChangeIntervalId);
    backgroundChangeIntervalId = null;
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
  isVideoFolderMode = false; // Not video mode

  // Store the URLs directly
  backgroundImages = imageUrls;

  console.log(`Loaded ${backgroundImages.length} images from list.`);

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
      changeBackgroundToNextImage();
      // Set up the timer for slideshow
      backgroundChangeIntervalId = setInterval(changeBackgroundToNextImage, slideShowInterval * 1000);
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

// --- 修改：更换到下一个背景图片的函数，支持 File 对象和 URL 字符串 ---
function changeBackgroundToNextImage() {
  if (!isFolderMode || isVideoFolderMode || backgroundImages.length === 0) { // 如果不是文件夹模式、是视频模式或者没有图片，则不执行
    return;
  }

  // Helper function to get the image source (File object or URL string) and its name
  function getImageSourceAndName(index) {
    const item = backgroundImages[index];
    if (item instanceof File) {
      return { source: URL.createObjectURL(item), name: item.name, isFile: true };
    } else if (typeof item === 'string') {
      // Extract filename from path for logging
      const parts = item.split('/');
      const name = parts[parts.length - 1];
      return { source: item, name: name, isFile: false };
    }
    return { source: null, name: 'unknown', isFile: false };
  }

  if (isTripleImageMode) {
    // 三图模式逻辑 (首次加载三张，之后每次替换一张)

    // 检查是否是首次加载（通过 nextTripleImageSlot 是否为 0 且 textures are not set）
    const isFirstLoad = nextTripleImageSlot === 0 &&
                        (!material.uniforms.u_tex0.value || !material.uniforms.u_tex1.value || !material.uniforms.u_tex2.value);

    if (isFirstLoad) {
        console.log(`Triple Mode: Initial load of first three images.`);

        // 获取前三个图片的索引
        const index0 = imageIndices[0];
        const index1 = imageIndices[1];
        const index2 = imageIndices[2];
        const imageInfo0 = getImageSourceAndName(index0);
        const imageInfo1 = getImageSourceAndName(index1);
        const imageInfo2 = getImageSourceAndName(index2);

        // 创建一个Promise数组来并行加载三张图片
        const texturePromises = [
          new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(imageInfo0.source, resolve, undefined, reject);
          }),
          new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(imageInfo1.source, resolve, undefined, reject);
          }),
          new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(imageInfo2.source, resolve, undefined, reject);
          })
        ];

        // 等待所有纹理加载完成
        Promise.all(texturePromises)
          .then(textures => {
            const [tex0, tex1, tex2] = textures;

            // 如果正在过渡，则跳过本次切换
            if (fadeTransition && fadeTransition.isTransitioning) {
              console.log("Transition in progress, skipping initial triple image load.");
              // 清理刚刚加载的纹理
              tex0.dispose();
              tex1.dispose();
              tex2.dispose();
              // Revoke object URLs if they were created
              if (imageInfo0.isFile) URL.revokeObjectURL(imageInfo0.source);
              if (imageInfo1.isFile) URL.revokeObjectURL(imageInfo1.source);
              if (imageInfo2.isFile) URL.revokeObjectURL(imageInfo2.source);
              return;
            }

            // 直接设置纹理（简化处理，实际应用中可能需要更复杂的过渡）
            disposeVideoElement(videoElement); // 如果之前有视频，先清理
            material.uniforms.u_tex0.value?.dispose();
            material.uniforms.u_tex1.value?.dispose();
            material.uniforms.u_tex2.value?.dispose();

            material.uniforms.u_tex0.value = tex0;
            material.uniforms.u_tex1.value = tex1;
            material.uniforms.u_tex2.value = tex2;
            material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex0.image.width, tex0.image.height);
            material.uniforms.u_tex1_resolution.value = new THREE.Vector2(tex1.image.width, tex1.image.height);
            material.uniforms.u_tex2_resolution.value = new THREE.Vector2(tex2.image.width, tex2.image.height);

            // 确保三图模式开启
            material.uniforms.u_triple_image_mode.value = true;

            console.log(`Triple Mode: Initial load complete. Displaying images ${imageInfo0.name}, ${imageInfo1.name}, ${imageInfo2.name}`);

            // Revoke object URLs after successful load and use
            if (imageInfo0.isFile) URL.revokeObjectURL(imageInfo0.source);
            if (imageInfo1.isFile) URL.revokeObjectURL(imageInfo1.source);
            if (imageInfo2.isFile) URL.revokeObjectURL(imageInfo2.source);
          })
          .catch(error => {
            console.error("Error loading initial textures for triple mode:", error);
            // Revoke object URLs on error
            if (imageInfo0.isFile) URL.revokeObjectURL(imageInfo0.source);
            if (imageInfo1.isFile) URL.revokeObjectURL(imageInfo1.source);
            if (imageInfo2.isFile) URL.revokeObjectURL(imageInfo2.source);
          });

        // 更新状态，准备下一次单张替换
        currentImageIndex = 3; // Next image to load
        nextTripleImageSlot = 0; // Will replace the first slot next

        return; // 首次加载完成，退出函数
    }

    // --- 后续单张替换逻辑 ---
    console.log(`Triple Mode: Replacing image in slot ${nextTripleImageSlot}`);

    // 检查是否需要重新打乱索引（当 currentImageIndex 超出范围时）
    if (currentImageIndex >= backgroundImages.length) {
        console.log("Triple Mode: All images shown, reshuffling indices.");
        initializeAndShuffleIndices(imageIndices, backgroundImages.length);
        currentImageIndex = 0;
    }

    // 获取下一张要加载的图片索引和文件
    const nextImageIndex = imageIndices[currentImageIndex];
    const nextImageInfo = getImageSourceAndName(nextImageIndex);
    console.log(`Triple Mode: Loading next image: ${nextImageInfo.name} (index: ${nextImageIndex})`);

    // 加载下一张图片
    new THREE.TextureLoader().load(nextImageInfo.source, function (newTexture) {

        // 如果正在过渡，则跳过本次切换
        if (fadeTransition && fadeTransition.isTransitioning) {
            console.log("Transition in progress, skipping single image replacement.");
            newTexture.dispose();
            // Revoke object URL on skip
            if (nextImageInfo.isFile) URL.revokeObjectURL(nextImageInfo.source);
            return;
        }

        // 根据 nextTripleImageSlot 决定替换哪张贴图
        let oldTextureToDispose = null;
        let oldTextureSlotIndex = -1;
        switch (nextTripleImageSlot) {
            case 0:
                oldTextureToDispose = material.uniforms.u_tex0.value;
                material.uniforms.u_tex0.value = newTexture;
                material.uniforms.u_tex0_resolution.value = new THREE.Vector2(newTexture.image.width, newTexture.image.height);
                tripleImageIndices[0] = nextImageIndex; // 更新索引记录
                oldTextureSlotIndex = 0;
                break;
            case 1:
                oldTextureToDispose = material.uniforms.u_tex1.value;
                material.uniforms.u_tex1.value = newTexture;
                material.uniforms.u_tex1_resolution.value = new THREE.Vector2(newTexture.image.width, newTexture.image.height);
                tripleImageIndices[1] = nextImageIndex; // 更新索引记录
                oldTextureSlotIndex = 1;
                break;
            case 2:
                oldTextureToDispose = material.uniforms.u_tex2.value;
                material.uniforms.u_tex2.value = newTexture;
                material.uniforms.u_tex2_resolution.value = new THREE.Vector2(newTexture.image.width, newTexture.image.height);
                tripleImageIndices[2] = nextImageIndex; // 更新索引记录
                oldTextureSlotIndex = 2;
                break;
        }

        // 清理被替换的旧纹理
        if (oldTextureToDispose) {
            oldTextureToDispose.dispose();
        }

        console.log(`Triple Mode: Replaced image in slot ${nextTripleImageSlot} with image ${nextImageInfo.name}. Slots now: [${tripleImageIndices[0]}, ${tripleImageIndices[1]}, ${tripleImageIndices[2]}]`);

        // 更新下一个要替换的槽位 (0 -> 1 -> 2 -> 0 ...)
        nextTripleImageSlot = (nextTripleImageSlot + 1) % 3;

        // Revoke the object URL for the loaded image after it's used
        if (nextImageInfo.isFile) URL.revokeObjectURL(nextImageInfo.source);

    }, undefined, function(error) {
        console.error("Error loading texture for single replacement in triple mode:", error);
        // Revoke object URL on error
        if (nextImageInfo.isFile) URL.revokeObjectURL(nextImageInfo.source);
    });

    // 更新 currentImageIndex，准备下下一张图片
    currentImageIndex++;
    // 再次检查是否需要重新打乱（在加载完成后）
    if (currentImageIndex >= backgroundImages.length) {
        console.log("Triple Mode: All images shown during single replacement cycle, reshuffling indices.");
        initializeAndShuffleIndices(imageIndices, backgroundImages.length);
        currentImageIndex = 0;
    }

  } else {
    // 单图模式逻辑（保持原有逻辑，但适配 File/URL）
    // 获取下一个图片索引
    const imageIndex = imageIndices[currentImageIndex];
    const imageInfo = getImageSourceAndName(imageIndex);
    console.log(`Single Mode: Changing background to: ${imageInfo.name} (index: ${imageIndex}, position: ${currentImageIndex + 1}/${backgroundImages.length})`);

    // 加载纹理
    new THREE.TextureLoader().load(imageInfo.source, function (tex) {
      // 如果正在过渡，则跳过本次切换
      if (fadeTransition && fadeTransition.isTransitioning) {
        console.log("Transition in progress, skipping image change.");
        tex.dispose(); // 清理刚刚加载的纹理
        // Revoke object URL on skip
        if (imageInfo.isFile) URL.revokeObjectURL(imageInfo.source);
        return;
      }

      // 启动淡入淡出过渡效果
      if (fadeTransition) {
        fadeTransition.startTransition(tex, new THREE.Vector2(tex.image.width, tex.image.height));
      } else {
        // 如果没有过渡效果实例，则直接切换
        disposeVideoElement(videoElement); // 如果之前有视频，先清理
        material.uniforms.u_tex0.value?.dispose(); // 清理旧纹理
        material.uniforms.u_tex0.value = tex;
        material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
        // 确保三图模式关闭
        material.uniforms.u_triple_image_mode.value = false;
      }

      // Revoke the object URL for the loaded image after it's used or transition starts
      if (imageInfo.isFile) URL.revokeObjectURL(imageInfo.source);
    }, undefined, function(error) {
        console.error("Error loading texture in single mode:", error);
        // Revoke object URL on error
        if (imageInfo.isFile) URL.revokeObjectURL(imageInfo.source);
    });

    // 更新索引，如果已遍历完所有图片，则重新打乱索引数组
    currentImageIndex++;
    if (currentImageIndex >= backgroundImages.length) {
      console.log("Single Mode: All images have been shown, reshuffling indices for next round");
      initializeAndShuffleIndices(imageIndices, backgroundImages.length);
      currentImageIndex = 0;
    }
  }
}
// --- 修改结束 ---

// --- 新增：播放下一个背景视频的函数 ---
function changeBackgroundToNextVideo() {
  if (!isFolderMode || !isVideoFolderMode || backgroundVideos.length === 0) { // 如果不是文件夹模式、不是视频模式或者没有视频，则不执行
    return;
  }

  // 获取下一个视频索引
  const videoIndex = videoIndices[currentVideoIndex];
  const videoFile = backgroundVideos[videoIndex];
  console.log(`Changing background to video: ${videoFile.name} (index: ${videoIndex}, position: ${currentVideoIndex + 1}/${backgroundVideos.length})`);

  // 清理之前的视频元素
  if (currentVideoElement) {
    disposeVideoElement(currentVideoElement);
  }

  // 清理旧纹理
  material.uniforms.u_tex0.value?.dispose();

  // 创建新的视频元素
  currentVideoElement = createVideoElement(URL.createObjectURL(videoFile), isVideoLoop);

  // 添加播放结束事件监听器
  currentVideoElement.addEventListener('ended', function() {
    console.log('Video ended, switching to next video');

    // 更新索引，如果已遍历完所有视频，则重新打乱索引数组
    currentVideoIndex++;
    if (currentVideoIndex >= backgroundVideos.length) {
      console.log("All videos have been shown, reshuffling indices for next round");
      initializeAndShuffleIndices(videoIndices, backgroundVideos.length);
      currentVideoIndex = 0;
    }

    changeBackgroundToNextVideo(); // 播放下一个视频
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
