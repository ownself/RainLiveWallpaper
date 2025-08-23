// 独立的 loadInitialTripleImages 函数定义，用于修复 bug

// Helper function to get the media source (File object or URL string) and its name, and determine type
// This function is also used in changeBackgroundForSlot
// --- 修改：简化路径处理，直接使用相对路径字符串 ---
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

        // --- 关键修改：直接返回原始相对路径字符串 ---
        // Lively 应该能够直接解析相对于 index.html 的路径
        console.log(`[getMediaSourceAndName] Using relative path directly: '${item}'`);
        return { source: item, name: name, isFile: false, isVideo: isVideo };
        // --- 修改结束 ---
    }
    return { source: null, name: 'unknown', isFile: false, isVideo: false };
}
// --- 修改结束 ---

// --- 新增：原子化地获取并递增 currentImageIndex ---
function getNextUniqueMediaIndex() {
    console.log(`[DEBUG] getNextUniqueMediaIndex called. currentImageIndex: ${currentImageIndex}, backgroundImages.length: ${backgroundImages.length}`);
    console.log(`[DEBUG] imageIndices: [${imageIndices.join(', ')}]`);
    
    // 检查是否需要重新打乱索引
    if (currentImageIndex >= backgroundImages.length) {
        console.log("Triple Mode: All images shown, reshuffling indices.");
        initializeAndShuffleIndices(imageIndices, backgroundImages.length);
        currentImageIndex = 0;
        console.log(`[DEBUG] After reshuffle, imageIndices: [${imageIndices.join(', ')}]`);
    }

    // 获取当前索引对应的值
    const indexToReturn = imageIndices[currentImageIndex];
    console.log(`[DEBUG] indexToReturn: ${indexToReturn}, imageIndices[${currentImageIndex}]: ${imageIndices[currentImageIndex]}`);
    // 立即递增索引，确保下一个调用者得到不同的值
    currentImageIndex++;
    console.log(`Triple Mode: Atomically assigned media index ${indexToReturn}. Next global index is ${currentImageIndex}.`);
    return indexToReturn;
}
// --- 新增结束 ---

// 保留原来的函数，但仅用于初始加载三张图片
function loadInitialTripleImages() {
    if (!isFolderMode || backgroundImages.length === 0 || !isTripleImageMode) {
        return;
    }
    
    console.log(`Triple Mode: Initial load of first three media items.`);
    
    // 获取前三个媒体的索引
    const index0 = imageIndices[0];
    const index1 = imageIndices[1];
    const index2 = imageIndices[2];
    const mediaInfo0 = getMediaSourceAndName(index0);
    const mediaInfo1 = getMediaSourceAndName(index1);
    const mediaInfo2 = getMediaSourceAndName(index2);
    
    // 更新 currentImageIndex，准备下下一张图片（对于视频，实际切换在 'ended' 事件中处理）
    // For images, increment now. For videos, it's handled in the 'ended' callback.
    // To simplify, we always increment here, and the 'ended' callback will just call the function again.
    // This ensures that if a video fails to load, the next item is still fetched.
    // 将 currentImageIndex 设置为 3，表示前三个已经加载
    currentImageIndex = 3;
    
    // 创建一个Promise数组来并行加载三张图片
    const texturePromises = [
      new Promise((resolve, reject) => {
        if (mediaInfo0.isVideo) {
            // For video, create a video element and a VideoTexture
            const videoElement = createVideoElement(mediaInfo0.source, false); // Do not loop auto-loaded videos
            videoElement.addEventListener('ended', () => {
                console.log(`Auto-loaded video ${mediaInfo0.name} (slot 0) ended, will trigger next media change.`);
                // Revoke object URL if it was created
                if (mediaInfo0.isFile) URL.revokeObjectURL(mediaInfo0.source);
                // Call the slot change function for the correct slot when video ends
                if (typeof window.changeBackgroundForSlot === 'function') {
                    // currentImageIndex was already set to 3 after initial load
                    // So we don't increment it here.
                    window.changeBackgroundForSlot(0); // Update slot 0
                }
            }, { once: true }); // Add { once: true }
            const videoTexture = new THREE.VideoTexture(videoElement);
            videoElement.addEventListener("loadedmetadata", () => {
                 resolve({ texture: videoTexture, resolution: new THREE.Vector2(videoTexture.image.videoWidth, videoTexture.image.videoHeight), isVideo: true });
            }, {once: true});
            videoElement.addEventListener("error", (e) => {
                reject(new Error(`Failed to load video: ${mediaInfo0.name}`));
                if (mediaInfo0.isFile) URL.revokeObjectURL(mediaInfo0.source);
            }, {once: true});
        } else {
            new THREE.TextureLoader().load(mediaInfo0.source, resolve, undefined, reject);
        }
      }),
      new Promise((resolve, reject) => {
        if (mediaInfo1.isVideo) {
            // For video, create a video element and a VideoTexture
            const videoElement = createVideoElement(mediaInfo1.source, false); // Do not loop auto-loaded videos
            videoElement.addEventListener('ended', () => {
                console.log(`Auto-loaded video ${mediaInfo1.name} (slot 1) ended, will trigger next media change.`);
                // Revoke object URL if it was created
                if (mediaInfo1.isFile) URL.revokeObjectURL(mediaInfo1.source);
                // Call the slot change function for the correct slot when video ends
                if (typeof window.changeBackgroundForSlot === 'function') {
                    // currentImageIndex was already set to 3 after initial load
                    // So we don't increment it here.
                    window.changeBackgroundForSlot(1); // Update slot 1
                }
            }, { once: true }); // Add { once: true }
            const videoTexture = new THREE.VideoTexture(videoElement);
            videoElement.addEventListener("loadedmetadata", () => {
                 resolve({ texture: videoTexture, resolution: new THREE.Vector2(videoTexture.image.videoWidth, videoTexture.image.videoHeight), isVideo: true });
            }, {once: true});
            videoElement.addEventListener("error", (e) => {
                reject(new Error(`Failed to load video: ${mediaInfo1.name}`));
                if (mediaInfo1.isFile) URL.revokeObjectURL(mediaInfo1.source);
            }, {once: true});
        } else {
            new THREE.TextureLoader().load(mediaInfo1.source, resolve, undefined, reject);
        }
      }),
      new Promise((resolve, reject) => {
        if (mediaInfo2.isVideo) {
            // For video, create a video element and a VideoTexture
            const videoElement = createVideoElement(mediaInfo2.source, false); // Do not loop auto-loaded videos
            videoElement.addEventListener('ended', () => {
                console.log(`Auto-loaded video ${mediaInfo2.name} (slot 2) ended, will trigger next media change.`);
                // Revoke object URL if it was created
                if (mediaInfo2.isFile) URL.revokeObjectURL(mediaInfo2.source);
                // Call the slot change function for the correct slot when video ends
                if (typeof window.changeBackgroundForSlot === 'function') {
                    // currentImageIndex was already set to 3 after initial load
                    // So we don't increment it here.
                    window.changeBackgroundForSlot(2); // Update slot 2
                }
            }, { once: true }); // Add { once: true }
            const videoTexture = new THREE.VideoTexture(videoElement);
            videoElement.addEventListener("loadedmetadata", () => {
                 resolve({ texture: videoTexture, resolution: new THREE.Vector2(videoTexture.image.videoWidth, videoTexture.image.videoHeight), isVideo: true });
            }, {once: true});
            videoElement.addEventListener("error", (e) => {
                reject(new Error(`Failed to load video: ${mediaInfo2.name}`));
                if (mediaInfo2.isFile) URL.revokeObjectURL(mediaInfo2.source);
            }, {once: true});
        } else {
            new THREE.TextureLoader().load(mediaInfo2.source, resolve, undefined, reject);
        }
      })
    ];
    
    // 等待所有纹理加载完成
    Promise.all(texturePromises)
      .then(results => {
        // const [tex0, tex1, tex2] = textures;
        const [result0, result1, result2] = results;
        const tex0 = result0 instanceof THREE.Texture ? result0 : result0.texture;
        const tex1 = result1 instanceof THREE.Texture ? result1 : result1.texture;
        const tex2 = result2 instanceof THREE.Texture ? result2 : result2.texture;
        
        // 如果正在过渡，则跳过本次切换
        if (fadeTransition && fadeTransition.isTransitioning) {
          console.log("Transition in progress, skipping initial triple media load.");
          // 清理刚刚加载的纹理
          tex0.dispose();
          tex1.dispose();
          tex2.dispose();
          // Revoke object URLs if they were created
          if (mediaInfo0.isFile) URL.revokeObjectURL(mediaInfo0.source);
          if (mediaInfo1.isFile) URL.revokeObjectURL(mediaInfo1.source);
          if (mediaInfo2.isFile) URL.revokeObjectURL(mediaInfo2.source);
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
        material.uniforms.u_tex0_resolution.value = result0.resolution || new THREE.Vector2(tex0.image.width, tex0.image.height);
        material.uniforms.u_tex1_resolution.value = result1.resolution || new THREE.Vector2(tex1.image.width, tex1.image.height);
        material.uniforms.u_tex2_resolution.value = result2.resolution || new THREE.Vector2(tex2.image.width, tex2.image.height);
        
        // 确保三图模式开启
        material.uniforms.u_triple_image_mode.value = true;
        
        console.log(`Triple Mode: Initial load complete. Displaying media ${mediaInfo0.name}, ${mediaInfo1.name}, ${mediaInfo2.name}`);
        
        // Revoke object URLs after successful load and use
        if (mediaInfo0.isFile && !mediaInfo0.isVideo) URL.revokeObjectURL(mediaInfo0.source);
        if (mediaInfo1.isFile && !mediaInfo1.isVideo) URL.revokeObjectURL(mediaInfo1.source);
        if (mediaInfo2.isFile && !mediaInfo2.isVideo) URL.revokeObjectURL(mediaInfo2.source);
        
        // --- 修改：初始加载后，只为图片槽位启动定时器 ---
        console.log("Initial triple load complete. Setting up timers for image slots only.");
        // currentImageIndex = 3; // 这行保留，因为 getNextUniqueMediaIndex 会继续使用它
        // 不再调用全局的 setupIndependentImageTimers

        // 检查初始加载的三个媒体，为图片槽位设置定时器
        if (!mediaInfo0.isVideo) {
            console.log("Scheduling timer for initial slot 0 (image)");
            // 确保调用的是 window 上的函数
            if (typeof window.scheduleImageChangeForSlot === 'function') {
                window.scheduleImageChangeForSlot(0);
            } else {
                console.error(`scheduleImageChangeForSlot function for slot 0 is not available from loadInitialTripleImages.js`);
            }
        } // 视频槽位不设置
        if (!mediaInfo1.isVideo) {
            console.log("Scheduling timer for initial slot 1 (image)");
            // 确保调用的是 window 上的函数
            if (typeof window.scheduleImageChangeForSlot === 'function') {
                window.scheduleImageChangeForSlot(1);
            } else {
                console.error(`scheduleImageChangeForSlot function for slot 1 is not available from loadInitialTripleImages.js`);
            }
        } // 视频槽位不设置
        if (!mediaInfo2.isVideo) {
            console.log("Scheduling timer for initial slot 2 (image)");
            // 确保调用的是 window 上的函数
            if (typeof window.scheduleImageChangeForSlot === 'function') {
                window.scheduleImageChangeForSlot(2);
            } else {
                console.error(`scheduleImageChangeForSlot function for slot 2 is not available from loadInitialTripleImages.js`);
            }
        } // 视频槽位不设置
        // --- 修改结束 ---
        
      })
      .catch(error => {
        console.error("Error loading initial textures for triple mode:", error);
        // Revoke object URLs on error
        if (mediaInfo0.isFile) URL.revokeObjectURL(mediaInfo0.source);
        if (mediaInfo1.isFile) URL.revokeObjectURL(mediaInfo1.source);
        if (mediaInfo2.isFile) URL.revokeObjectURL(mediaInfo2.source);
      });
}

// 将 setupIndependentImageTimers 函数也放在这里，确保它在 loadInitialTripleImages 之后定义，这样 loadInitialTripleImages 可以调用它
// 将 setupIndependentImageTimers 函数挂载到 window 对象上，使其可以在其他文件中访问
// --- 修改 script.js 中的 setupIndependentImageTimers ---
window.setupIndependentImageTimers = function() {
    if (!isFolderMode || backgroundImages.length === 0 || !isTripleImageMode) {
        console.warn("Cannot setup independent timers: Not in triple image folder mode.");
        return;
    }
    
    console.log("Setting up independent random timers for each image slot (called from script.js).");
    
    // 清除所有现有的定时器
    Object.values(imageChangeTimers).forEach(id => clearTimeout(id));
    imageChangeTimers = {};
    
    // 为每个槽位设置独立的定时器
    // 注意：这会为所有槽位设置定时器，包括视频槽位。
    // 在新的逻辑下，这可能不是我们想要的，因为视频槽位应由 ended 事件驱动。
    // 但如果在某些场景下调用了它，我们需要确保它只影响图片。
    // 一种方法是检查当前 material.uniforms 中的纹理类型，但这比较复杂。
    // 最简单的兼容方法是让它运行，但依靠 changeBackgroundForSlot 内部的逻辑来处理。
    for (let slot = 0; slot < 3; slot++) {
        // 确保调用的是 window 上的函数
        if (typeof window.scheduleImageChangeForSlot === 'function') {
            window.scheduleImageChangeForSlot(slot);
        } else {
            console.error(`scheduleImageChangeForSlot function for slot ${slot} is not available from loadInitialTripleImages.js`);
        }
    }
};
// --- 修改结束 ---

function scheduleImageChangeForSlot(slot) {
    // 计算随机间隔时间 (slideShowInterval 到 slideShowInterval * 2 之间)
    const randomInterval = (slideShowInterval + Math.random() * slideShowInterval) * 1000;
    console.log(`Scheduling next image change for slot ${slot} in ${randomInterval / 1000} seconds.`);
    
    // 设置新的定时器
    const timerId = setTimeout(() => {
        console.log(`Timer fired for slot ${slot}. Calling changeBackgroundForSlot.`);
        // 确保调用的是 window 上的函数
        if (typeof window.changeBackgroundForSlot === 'function') {
            window.changeBackgroundForSlot(slot);
        } else {
            console.error(`changeBackgroundForSlot function for slot ${slot} is not available from loadInitialTripleImages.js`);
        }
        // Note: Do not recursively call scheduleImageChangeForSlot here.
        // The recursion is handled by changeBackgroundForSlot calling scheduleImageChangeForSlot
        // for images, and by the 'ended' event listener for videos.
        // This function only sets a single timeout.
    }, randomInterval);
    
    // 存储定时器ID
    imageChangeTimers[slot] = timerId; // 这里存储的是图片的定时器
};

// Modify changeBackgroundForSlot to handle both images and videos
// --- 彻底重写此函数 ---
function changeBackgroundForSlot(slot) {
    if (!isFolderMode || backgroundImages.length === 0 || !isTripleImageMode) {
        console.warn(`changeBackgroundForSlot: Cannot proceed, mode flags not suitable for slot ${slot}.`);
        return;
    }
    
    console.log(`--- Changing background for slot ${slot} ---`);
    console.log(`[DEBUG] Slot ${slot} - currentImageIndex before get: ${currentImageIndex}, tripleImageIndices: [${tripleImageIndices[0]}, ${tripleImageIndices[1]}, ${tripleImageIndices[2]}]`);

    // --- 关键修改 1: 立即清除该槽位的任何现有定时器 ---
    if (imageChangeTimers[slot]) {
        console.log(`Clearing existing timer for slot ${slot}`);
        clearTimeout(imageChangeTimers[slot]);
        delete imageChangeTimers[slot]; // 从对象中移除引用
    }
    // --- 关键修改 1 结束 ---

    // --- 关键修改 2: 原子化地获取下一个唯一的媒体索引 ---
    const nextMediaIndex = getNextUniqueMediaIndex();
    console.log(`[DEBUG] Slot ${slot} - Got nextMediaIndex: ${nextMediaIndex}`);
    // --- 关键修改 2 结束 ---

    const nextMediaInfo = getMediaSourceAndName(nextMediaIndex);
    console.log(`Triple Mode: Loading next media for slot ${slot}: ${nextMediaInfo.name} (index: ${nextMediaIndex})`);
    
    if (nextMediaInfo.isVideo) {
        console.log(`[DEBUG] Slot ${slot} - Loading video: ${nextMediaInfo.name}`);
        // Handle video
        try {
            // Create video element
            const videoElement = createVideoElement(nextMediaInfo.source, false); // Do not loop auto-loaded videos by default
            
            // --- 关键修改 3: 在加载时（成功前）就更新索引记录 ---
            // 这能确保在加载过程中，其他并发的调用能看到这个槽位即将被占用的索引
            switch (slot) {
                case 0: tripleImageIndices[0] = nextMediaIndex; break;
                case 1: tripleImageIndices[1] = nextMediaIndex; break;
                case 2: tripleImageIndices[2] = nextMediaIndex; break;
            }
            console.log(`Triple Mode: Slot ${slot} reserved index ${nextMediaIndex}. Slots now: [${tripleImageIndices[0]}, ${tripleImageIndices[1]}, ${tripleImageIndices[2]}]`);
            // --- 关键修改 3 结束 ---

            // Add event listener for when the video ends
            videoElement.addEventListener('ended', function onVideoEnded() {
                console.log(`Video ${nextMediaInfo.name} in slot ${slot} ended.`);
                
                // Revoke object URL if it was created
                if (nextMediaInfo.isFile) URL.revokeObjectURL(nextMediaInfo.source);
                
                // 视频结束后，触发该槽位的下一次切换
                console.log(`Triggering next change for slot ${slot} after video ended.`);
                setTimeout(() => {
                    // 确保调用的是 window 上的函数
                    if (typeof window.changeBackgroundForSlot === 'function') {
                        window.changeBackgroundForSlot(slot);
                    } else {
                        console.error(`changeBackgroundForSlot function for slot ${slot} is not available from loadInitialTripleImages.js`);
                    }
                }, 100); // 小延迟确保清理完成
            }, { once: true }); // Use { once: true } to automatically remove the listener after it fires
            
            // Create VideoTexture
            const videoTexture = new THREE.VideoTexture(videoElement);
            
            // Wait for metadata to load the resolution
            videoElement.addEventListener("loadedmetadata", function onMetadataLoaded() {
                console.log(`[DEBUG] Slot ${slot} - Video metadata loaded: ${nextMediaInfo.name}`);
                // Update material uniforms with the new video texture and resolution
                let oldTextureToDispose = null;
                switch (slot) {
                    case 0:
                        oldTextureToDispose = material.uniforms.u_tex0.value;
                        material.uniforms.u_tex0.value = videoTexture;
                        material.uniforms.u_tex0_resolution.value = new THREE.Vector2(videoTexture.image.videoWidth, videoTexture.image.videoHeight);
                        // tripleImageIndices[0] 已在加载时更新
                        break;
                    case 1:
                        oldTextureToDispose = material.uniforms.u_tex1.value;
                        material.uniforms.u_tex1.value = videoTexture;
                        material.uniforms.u_tex1_resolution.value = new THREE.Vector2(videoTexture.image.videoWidth, videoTexture.image.videoHeight);
                        // tripleImageIndices[1] 已在加载时更新
                        break;
                    case 2:
                        oldTextureToDispose = material.uniforms.u_tex2.value;
                        material.uniforms.u_tex2.value = videoTexture;
                        material.uniforms.u_tex2_resolution.value = new THREE.Vector2(videoTexture.image.videoWidth, videoTexture.image.videoHeight);
                        // tripleImageIndices[2] 已在加载时更新
                        break;
                }
                
                // Clean up the old texture
                if (oldTextureToDispose && oldTextureToDispose !== videoTexture) {
                    console.log(`Triple Mode: Disposing old texture in slot ${slot}.`);
                    if (oldTextureToDispose instanceof THREE.VideoTexture && oldTextureToDispose.image) {
                        disposeVideoElement(oldTextureToDispose.image);
                    }
                    oldTextureToDispose.dispose();
                }
                
                console.log(`Triple Mode: Successfully replaced media in slot ${slot} with video ${nextMediaInfo.name}. Slots now: [${tripleImageIndices[0]}, ${tripleImageIndices[1]}, ${tripleImageIndices[2]}]`);
                
            }, { once: true });
            
            // Add error listener
            videoElement.addEventListener("error", function onVideoError(e) {
                console.error(`Error loading video for slot ${slot}:`, e);
                // Revoke object URL on error
                if (nextMediaInfo.isFile) URL.revokeObjectURL(nextMediaInfo.source);
                // Clean up video texture
                videoTexture.dispose();
                // Dispose video element
                disposeVideoElement(videoElement);

                // Load next media after a delay
                console.log(`Retrying change for slot ${slot} after video load error.`);
                setTimeout(() => {
                    // 确保调用的是 window 上的函数
                    if (typeof window.changeBackgroundForSlot === 'function') {
                        window.changeBackgroundForSlot(slot);
                    } else {
                        console.error(`changeBackgroundForSlot function for slot ${slot} is not available from loadInitialTripleImages.js`);
                    }
                }, 1000);
            }, { once: true });
            
        } catch (error) {
            console.error(`Error creating video element for slot ${slot}:`, error);
            // Revoke object URL on error
            if (nextMediaInfo.isFile) URL.revokeObjectURL(nextMediaInfo.source);

            // Load next media after a delay
            console.log(`Retrying change for slot ${slot} after video creation error.`);
            setTimeout(() => {
                // 确保调用的是 window 上的函数
                if (typeof window.changeBackgroundForSlot === 'function') {
                    window.changeBackgroundForSlot(slot);
                } else {
                    console.error(`changeBackgroundForSlot function for slot ${slot} is not available from loadInitialTripleImages.js`);
                }
            }, 1000);
        }
        
        // --- 关键修改 4: 对于视频，绝对不设置新的 setTimeout 定时器 ---
        // 视频的下一次切换由 'ended' 事件触发
        console.log(`Video loaded in slot ${slot}. No new timer set.`);
        
    } else {
        console.log(`[DEBUG] Slot ${slot} - Loading image: ${nextMediaInfo.name}`);
        // Handle image (existing logic but with clearer timer management)
        new THREE.TextureLoader().load(nextMediaInfo.source, function (newTexture) {
            console.log(`[DEBUG] Slot ${slot} - Image loaded: ${nextMediaInfo.name}`);
            // 如果正在过渡，则跳过本次切换
            if (fadeTransition && fadeTransition.isTransitioning) {
                console.log(`Transition in progress, skipping image change for slot ${slot}.`);
                newTexture.dispose(); // 清理刚刚加载的纹理
                // Revoke object URL on skip
                if (nextMediaInfo.isFile) URL.revokeObjectURL(nextMediaInfo.source);
                return;
            }
            
            // 根据 slot 决定替换哪张贴图
            let oldTextureToDispose = null;
            switch (slot) {
                case 0:
                    oldTextureToDispose = material.uniforms.u_tex0.value;
                    material.uniforms.u_tex0.value = newTexture;
                    material.uniforms.u_tex0_resolution.value = new THREE.Vector2(newTexture.image.width, newTexture.image.height);
                    tripleImageIndices[0] = nextMediaIndex; // 更新索引记录
                    break;
                case 1:
                    oldTextureToDispose = material.uniforms.u_tex1.value;
                    material.uniforms.u_tex1.value = newTexture;
                    material.uniforms.u_tex1_resolution.value = new THREE.Vector2(newTexture.image.width, newTexture.image.height);
                    tripleImageIndices[1] = nextMediaIndex; // 更新索引记录
                    break;
                case 2:
                    oldTextureToDispose = material.uniforms.u_tex2.value;
                    material.uniforms.u_tex2.value = newTexture;
                    material.uniforms.u_tex2_resolution.value = new THREE.Vector2(newTexture.image.width, newTexture.image.height);
                    tripleImageIndices[2] = nextMediaIndex; // 更新索引记录
                    break;
            }
            
            // 清理被替换的旧纹理
            if (oldTextureToDispose) {
                console.log(`Triple Mode: Disposing old texture in slot ${slot}.`);
                oldTextureToDispose.dispose();
            }
            
            console.log(`Triple Mode: Successfully replaced media in slot ${slot} with image ${nextMediaInfo.name}. Slots now: [${tripleImageIndices[0]}, ${tripleImageIndices[1]}, ${tripleImageIndices[2]}]`);
            
            // Revoke the object URL for the loaded image after it's used
            if (nextMediaInfo.isFile) URL.revokeObjectURL(nextMediaInfo.source);
            
            // --- 关键修改 5: 对于图片，成功加载后，为该槽位安排下一次切换 ---
            // 这是图片的逻辑，与视频不同
            console.log(`Image loaded in slot ${slot}. Scheduling next change.`);
            // 确保调用的是 window 上的函数
            if (typeof window.scheduleImageChangeForSlot === 'function') {
                window.scheduleImageChangeForSlot(slot); // 只为图片槽位设置
            } else {
                console.error(`scheduleImageChangeForSlot function for slot ${slot} is not available from loadInitialTripleImages.js`);
            }
            
        }, undefined, function(error) {
            console.error(`Error loading texture for slot ${slot} in triple mode:`, error);
            // Revoke object URL on error
            if (nextMediaInfo.isFile) URL.revokeObjectURL(nextMediaInfo.source);

            // Load next media after a delay
            console.log(`Retrying change for slot ${slot} after image load error.`);
            setTimeout(() => {
                // 确保调用的是 window 上的函数
                if (typeof window.changeBackgroundForSlot === 'function') {
                    window.changeBackgroundForSlot(slot);
                } else {
                    console.error(`changeBackgroundForSlot function for slot ${slot} is not available from loadInitialTripleImages.js`);
                }
            }, 1000);
        });
    }
    
    console.log(`[DEBUG] Slot ${slot} - changeBackgroundForSlot finished.`);
}
// --- 彻底重写结束 ---