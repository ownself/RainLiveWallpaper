// --- 修改：更换到下一个背景图片的函数，支持 File 对象和 URL 字符串 ---
// --- 修改为：仅用于单图模式 ---
function changeBackgroundToNextImage() {
  if (!isFolderMode || isVideoFolderMode || backgroundImages.length === 0 || isTripleImageMode) { // 如果不是文件夹模式、是视频模式、没有图片或处于三图模式，则不执行
    return;
  }

  // Helper function to get the media source (File object or URL string) and its name, and determine type
  function getMediaSourceAndName(index) {
    const item = backgroundImages[index];
    if (item instanceof File) {
      const isVideo = item.type.startsWith('video/');
      return { source: URL.createObjectURL(item), name: item.name, isFile: true, isVideo: isVideo };
    } else if (typeof item === 'string') {
      // Extract filename from path for logging
      const parts = item.split('/');
      const name = parts[parts.length - 1];
      // Basic check for video extension
      const lowerName = name.toLowerCase();
      const isVideo = lowerName.endsWith('.mp4') || lowerName.endsWith('.webm') || lowerName.endsWith('.ogg');
      return { source: item, name: name, isFile: false, isVideo: isVideo };
    }
    return { source: null, name: 'unknown', isFile: false, isVideo: false };
  }

  // 单图模式逻辑（保持原有逻辑，但适配 File/URL 和视频）
  // 获取下一个媒体索引
  const mediaIndex = imageIndices[currentImageIndex];
  const mediaInfo = getMediaSourceAndName(mediaIndex);
  console.log(`Single Mode: Changing background to: ${mediaInfo.name} (index: ${mediaIndex}, position: ${currentImageIndex + 1}/${backgroundImages.length})`);

  if (mediaInfo.isVideo) {
    // Handle video
    try {
      // Clear any existing video element and texture
      disposeVideoElement(videoElement);
      material.uniforms.u_tex0.value?.dispose();
      
      // Create new video element
      // For single mode, we loop the video by default when selected manually or via list
      videoElement = createVideoElement(mediaInfo.source, true);
      
      // Create VideoTexture
      let videoTexture = new THREE.VideoTexture(videoElement);
      
      // Add loadedmetadata listener to update resolution
      videoElement.addEventListener("loadedmetadata", function onMetadataLoaded() {
          material.uniforms.u_tex0_resolution.value = new THREE.Vector2(
            videoTexture.image.videoWidth,
            videoTexture.image.videoHeight
          );
          
          // Set the video texture to the material
          material.uniforms.u_tex0.value = videoTexture;
          
          // Ensure triple mode is off
          material.uniforms.u_triple_image_mode.value = false;
          
          // Revoke object URL after use
          if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
          
          // For single mode video, we don't set a timer. It plays until manually changed or 'ended' (if not looping).
          // If you want a timer for videos in single mode as well, you can add it here.
          // scheduleNextImageChange(); // Optional: if you want timed video changes in single mode too.
          
      }, { once: true });
      
      // Add error listener
      videoElement.addEventListener("error", function onVideoError(e) {
          console.error("Error loading video in single mode:", e);
          // Revoke object URL on error
          if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
          // Clean up video texture
          videoTexture.dispose();
          // Dispose video element
          disposeVideoElement(videoElement);
          // Try next media
          currentImageIndex++;
          if (currentImageIndex >= backgroundImages.length) {
            console.log("Single Mode: All media have been shown, reshuffling indices for next round");
            initializeAndShuffleIndices(imageIndices, backgroundImages.length);
            currentImageIndex = 0;
          }
          // Add a small delay before retrying
          setTimeout(() => {
              changeBackgroundToNextImage();
          }, 1000);
      }, { once: true });
      
      // For single mode, if you want the video to trigger the next change when it ends (even if looping is off)
      // You can add an 'ended' listener here as well, similar to triple mode.
      // However, typically for single mode, a looping video is expected to play continuously.
      // If `isVideoLoop` is false, you might want to trigger the next change.
      /*
      if (!isVideoLoop) { // Assuming you have an `isVideoLoop` flag for single mode
        videoElement.addEventListener('ended', function onVideoEnded() {
            console.log(`Video ${mediaInfo.name} ended in single mode.`);
            if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
            // Trigger next change
            currentImageIndex++;
            if (currentImageIndex >= backgroundImages.length) {
              console.log("Single Mode: All media have been shown, reshuffling indices for next round");
              initializeAndShuffleIndices(imageIndices, backgroundImages.length);
              currentImageIndex = 0;
            }
            // Add a small delay
            setTimeout(() => {
                changeBackgroundToNextImage();
            }, 1000);
        }, { once: true });
      }
      */
      
    } catch (error) {
      console.error("Error creating video element in single mode:", error);
      // Revoke object URL on error
      if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
      // Try next media
      currentImageIndex++;
      if (currentImageIndex >= backgroundImages.length) {
        console.log("Single Mode: All media have been shown, reshuffling indices for next round");
        initializeAndShuffleIndices(imageIndices, backgroundImages.length);
        currentImageIndex = 0;
      }
      // Add a small delay before retrying
      setTimeout(() => {
          changeBackgroundToNextImage();
      }, 1000);
    }
    
  } else {
    // Handle image
    // 加载纹理
    new THREE.TextureLoader().load(mediaInfo.source, function (tex) {
      // 如果正在过渡，则跳过本次切换
      if (fadeTransition && fadeTransition.isTransitioning) {
        console.log("Transition in progress, skipping image change.");
        tex.dispose(); // 清理刚刚加载的纹理
        // Revoke object URL on skip
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

      // Revoke the object URL for the loaded image after it's used or transition starts
      if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
      
      // 为单图模式设置下一次切换的定时器
      scheduleNextImageChange();

    }, undefined, function(error) {
        console.error("Error loading texture in single mode:", error);
        // Revoke object URL on error
        if (mediaInfo.isFile) URL.revokeObjectURL(mediaInfo.source);
        // Try next media
        currentImageIndex++;
        if (currentImageIndex >= backgroundImages.length) {
          console.log("Single Mode: All media have been shown, reshuffling indices for next round");
          initializeAndShuffleIndices(imageIndices, backgroundImages.length);
          currentImageIndex = 0;
        }
        // Add a small delay before retrying
        setTimeout(() => {
            changeBackgroundToNextImage();
        }, 1000);
    });
  }

  // 更新索引，如果已遍历完所有图片，则重新打乱索引数组
  // For video, we might not increment immediately, but for simplicity, we do.
  // The error/ended handlers will handle retries.
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