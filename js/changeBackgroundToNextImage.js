// --- 修改：更换到下一个背景图片的函数，支持 File 对象和 URL 字符串 ---
// --- 修改为：仅用于单图模式 ---
function changeBackgroundToNextImage() {
  // --- 修复：移除对未定义变量 isVideoFolderMode 的引用 ---
  // if (!isFolderMode || isVideoFolderMode || backgroundImages.length === 0 || isTripleImageMode) { // 如果不是文件夹模式、是视频模式、没有图片或处于三图模式，则不执行
  if (!isFolderMode || backgroundImages.length === 0 || isTripleImageMode) {
  // --- 修复结束 ---
    return;
  }

  // Helper function to get the媒体源 (File 对象或 URL 字符串)及其名称，并确定类型
  // --- 更新此函数以使用新的路径解析逻辑 ---
  function getMediaSourceAndName(index) {
    const item = backgroundImages[index];
    if (item instanceof File) {
      const isVideo = item.type.startsWith('video/');
      return { source: URL.createObjectURL(item), name: item.name, isFile: true, isVideo: isVideo };
    } else if (typeof item === 'string') {
      // 从路径中提取文件名用于日志记录
      const parts = item.split('/');
      const name = parts[parts.length - 1];
      // 基本的视频扩展名检查
      const lowerName = name.toLowerCase();
      const isVideo = lowerName.endsWith('.mp4') || lowerName.endsWith('.webm') || lowerName.endsWith('.ogg');

      // --- 关键修改：直接返回原始相对路径字符串 ---
      // Lively 应该能够直接解析相对于 index.html 的路径
      console.log(`[changeBackgroundToNextImage.js::getMediaSourceAndName] Using relative path directly: '${item}'`);
      return { source: item, name: name, isFile: false, isVideo: isVideo };
      // --- 修改结束 ---
    }
    return { source: null, name: 'unknown', isFile: false, isVideo: false };
  }
  // --- 更新结束 ---

  // 单图模式逻辑（保持原有逻辑，但适配 File/URL 和视频）
  // 获取下一个媒体索引
  const mediaIndex = imageIndices[currentImageIndex];
  const mediaInfo = getMediaSourceAndName(mediaIndex);
  console.log(`Single Mode: Changing background to: ${mediaInfo.name} (index: ${mediaIndex}, position: ${currentImageIndex + 1}/${backgroundImages.length})`);

  // ... rest of the function remains the same ...

  // ... rest of the function remains the same ...

  if (mediaInfo.isVideo) {
    // 处理视频
    try {
      // 清除任何现有的视频元素和纹理
      disposeVideoElement(videoElement);
      material.uniforms.u_tex0.value?.dispose();
      
      // 创建新的视频元素
      // 对于单图模式，当手动选择或通过列表选择时，默认循环播放视频
      videoElement = createVideoElement(mediaInfo.source, true);
      
      // 创建 VideoTexture
      let videoTexture = new THREE.VideoTexture(videoElement);
      
      // 添加 loadedmetadata 监听器以更新分辨率
      videoElement.addEventListener("loadedmetadata", function onMetadataLoaded() {
          material.uniforms.u_tex0_resolution.value = new THREE.Vector2(
            videoTexture.image.videoWidth,
            videoTexture.image.videoHeight
          );
          
          // 将视频纹理设置到材质上
          material.uniforms.u_tex0.value = videoTexture;
          
          // 确保三图模式关闭
          material.uniforms.u_triple_image_mode.value = false;
          
          // 使用后撤销对象 URL
          if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
          
          // 对于单图模式视频，我们不设置定时器。它会一直播放直到手动更改或 'ended'（如果不循环）。
          // 如果你也想在单图模式下为视频设置定时器，可以在这里添加。
          // scheduleNextImageChange(); // 可选：如果你想在单图模式下也定时切换视频。
          
      }, { once: true });
      
      // 添加错误监听器
      videoElement.addEventListener("error", function onVideoError(e) {
          console.error("Error loading video in single mode:", e);
          // 出错时撤销对象 URL
          if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
          // 清理视频纹理
          videoTexture.dispose();
          // 清理视频元素
          disposeVideoElement(videoElement);
          // 尝试下一个媒体
          currentImageIndex++;
          if (currentImageIndex >= backgroundImages.length) {
            console.log("Single Mode: All media have been shown, reshuffling indices for next round");
            initializeAndShuffleIndices(imageIndices, backgroundImages.length);
            currentImageIndex = 0;
          }
          // 添加一个小延迟后重试
          setTimeout(() => {
              changeBackgroundToNextImage();
          }, 1000);
      }, { once: true });
      
      // 对于单图模式，如果你想在视频结束时（即使不循环）触发下一次更改
      // 你也可以在这里添加一个 'ended' 监听器，类似于三图模式。
      // 然而，通常对于单图模式，期望循环播放视频。
      // 如果 `isVideoLoop` 是 false，你可能想触发下一次更改。
      /*
      if (!isVideoLoop) { // 假设你有一个 `isVideoLoop` 标志用于单图模式
        videoElement.addEventListener('ended', function onVideoEnded() {
            console.log(`Video ${mediaInfo.name} ended in single mode.`);
            if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
            // 触发下一次更改
            currentImageIndex++;
            if (currentImageIndex >= backgroundImages.length) {
              console.log("Single Mode: All media have been shown, reshuffling indices for next round");
              initializeAndShuffleIndices(imageIndices, backgroundImages.length);
              currentImageIndex = 0;
            }
            // 添加一个小延迟
            setTimeout(() => {
                changeBackgroundToNextImage();
            }, 1000);
        }, { once: true });
      }
      */
      
    } catch (error) {
      console.error("Error creating video element in single mode:", error);
      // 出错时撤销对象 URL
      if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
      // 尝试下一个媒体
      currentImageIndex++;
      if (currentImageIndex >= backgroundImages.length) {
        console.log("Single Mode: All media have been shown, reshuffling indices for next round");
        initializeAndShuffleIndices(imageIndices, backgroundImages.length);
        currentImageIndex = 0;
      }
      // 添加一个小延迟后重试
      setTimeout(() => {
          changeBackgroundToNextImage();
      }, 1000);
    }
    
  } else {
    // 处理图片
    // 加载纹理
    new THREE.TextureLoader().load(mediaInfo.source, function (tex) {
      // 如果正在过渡，则跳过本次切换
      if (fadeTransition && fadeTransition.isTransitioning) {
        console.log("Transition in progress, skipping image change.");
        tex.dispose(); // 清理刚刚加载的纹理
        // 跳过时撤销对象 URL
        if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
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

      // 使用后或过渡开始后撤销对象 URL
      if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
      
      // 为单图模式设置下一次切换的定时器
      scheduleNextImageChange();

    }, undefined, function(error) {
        console.error("Error loading texture in single mode:", error);
        // 出错时撤销对象 URL
        if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
        // 尝试下一个媒体
        currentImageIndex++;
        if (currentImageIndex >= backgroundImages.length) {
          console.log("Single Mode: All media have been shown, reshuffling indices for next round");
          initializeAndShuffleIndices(imageIndices, backgroundImages.length);
          currentImageIndex = 0;
        }
        // 添加一个小延迟后重试
        setTimeout(() => {
            changeBackgroundToNextImage();
        }, 1000);
    });
  }

  // 更新索引，如果已遍历完所有图片，则重新打乱索引数组
  // 对于视频，我们可能不会立即递增，但为了简单起见，我们这样做。
  // 错误/结束处理程序将处理重试。
  currentImageIndex++;
  if (currentImageIndex >= backgroundImages.length) {
    console.log("Single Mode: All media have been shown, reshuffling indices for next round");
    initializeAndShuffleIndices(imageIndices, backgroundImages.length);
    currentImageIndex = 0;
  }
  
  // --- 新增：为下一次图片切换设置定时器 ---
  function scheduleNextImageChange() {
    // 清除之前的定时器
    if (backgroundChangeIntervalId) {
      clearTimeout(backgroundChangeIntervalId);
      backgroundChangeIntervalId = null;
    }
    
    // 计算随机间隔时间 (slideShowInterval 到 slideShowInterval * 2 之间)
    const randomInterval = (slideShowInterval + Math.random() * slideShowInterval) * 1000;
    console.log(`Scheduling next image change in ${randomInterval / 1000} seconds.`);
    
    // 设置新的定时器
    backgroundChangeIntervalId = setTimeout(() => {
        changeBackgroundToNextImage();
    }, randomInterval);
  }
  // --- 新增结束 ---
}
// --- 修改结束 ---