// 独立的 loadInitialTripleImages 函数定义，用于修复 bug

// 保留原来的函数，但仅用于初始加载三张图片
function loadInitialTripleImages() {
    if (!isFolderMode || isVideoFolderMode || backgroundImages.length === 0 || !isTripleImageMode) {
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
        
        // 初始化独立定时器
        currentImageIndex = 3; // Next image to load
        // setupIndependentImageTimers(); // 先注释掉这行
        // 使用 window 对象来调用在 script.js 中定义的函数
        if (typeof window.setupIndependentImageTimers === 'function') {
            window.setupIndependentImageTimers();
        } else {
            console.error("setupIndependentImageTimers is not defined on window object");
        }
        
      })
      .catch(error => {
        console.error("Error loading initial textures for triple mode:", error);
        // Revoke object URLs on error
        if (imageInfo0.isFile) URL.revokeObjectURL(imageInfo0.source);
        if (imageInfo1.isFile) URL.revokeObjectURL(imageInfo1.source);
        if (imageInfo2.isFile) URL.revokeObjectURL(imageInfo2.source);
      });
}

// 将 setupIndependentImageTimers 函数也放在这里，确保它在 loadInitialTripleImages 之后定义，这样 loadInitialTripleImages 可以调用它
// 将 setupIndependentImageTimers 函数挂载到 window 对象上，使其可以在其他文件中访问
window.setupIndependentImageTimers = function() {
    if (!isFolderMode || isVideoFolderMode || backgroundImages.length === 0 || !isTripleImageMode) {
        console.warn("Cannot setup independent timers: Not in triple image folder mode.");
        return;
    }
    
    console.log("Setting up independent random timers for each image slot.");
    
    // 清除所有现有的定时器
    Object.values(imageChangeTimers).forEach(id => clearTimeout(id));
    imageChangeTimers = {};
    
    // 为每个槽位设置独立的定时器
    for (let slot = 0; slot < 3; slot++) {
        scheduleImageChangeForSlot(slot);
    }
};

function scheduleImageChangeForSlot(slot) {
    // 计算随机间隔时间 (slideShowInterval 到 slideShowInterval * 2 之间)
    const randomInterval = (slideShowInterval + Math.random() * slideShowInterval) * 1000;
    console.log(`Scheduling next image change for slot ${slot} in ${randomInterval / 1000} seconds.`);
    
    // 设置新的定时器
    const timerId = setTimeout(() => {
        changeBackgroundForSlot(slot);
        // 递归调用以设置下一次定时器
        scheduleImageChangeForSlot(slot);
    }, randomInterval);
    
    // 存储定时器ID
    imageChangeTimers[slot] = timerId;
};

function changeBackgroundForSlot(slot) {
    if (!isFolderMode || isVideoFolderMode || backgroundImages.length === 0 || !isTripleImageMode) {
        return;
    }
    
    console.log(`Changing background for slot ${slot}`);
    
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
    
    // 检查是否需要重新打乱索引（当 currentImageIndex 超出范围时）
    if (currentImageIndex >= backgroundImages.length) {
        console.log("Triple Mode: All images shown, reshuffling indices.");
        initializeAndShuffleIndices(imageIndices, backgroundImages.length);
        currentImageIndex = 0;
    }
    
    // 获取下一张要加载的图片索引和文件
    const nextImageIndex = imageIndices[currentImageIndex];
    const nextImageInfo = getImageSourceAndName(nextImageIndex);
    console.log(`Triple Mode: Loading next image for slot ${slot}: ${nextImageInfo.name} (index: ${nextImageIndex})`);
    
    // 加载下一张图片
    new THREE.TextureLoader().load(nextImageInfo.source, function (newTexture) {
        // 如果正在过渡，则跳过本次切换
        if (fadeTransition && fadeTransition.isTransitioning) {
            console.log(`Transition in progress, skipping image change for slot ${slot}.`);
            newTexture.dispose();
            // Revoke object URL on skip
            if (nextImageInfo.isFile) URL.revokeObjectURL(nextImageInfo.source);
            return;
        }
        
        // 根据 slot 决定替换哪张贴图
        let oldTextureToDispose = null;
        switch (slot) {
            case 0:
                oldTextureToDispose = material.uniforms.u_tex0.value;
                material.uniforms.u_tex0.value = newTexture;
                material.uniforms.u_tex0_resolution.value = new THREE.Vector2(newTexture.image.width, newTexture.image.height);
                tripleImageIndices[0] = nextImageIndex; // 更新索引记录
                break;
            case 1:
                oldTextureToDispose = material.uniforms.u_tex1.value;
                material.uniforms.u_tex1.value = newTexture;
                material.uniforms.u_tex1_resolution.value = new THREE.Vector2(newTexture.image.width, newTexture.image.height);
                tripleImageIndices[1] = nextImageIndex; // 更新索引记录
                break;
            case 2:
                oldTextureToDispose = material.uniforms.u_tex2.value;
                material.uniforms.u_tex2.value = newTexture;
                material.uniforms.u_tex2_resolution.value = new THREE.Vector2(newTexture.image.width, newTexture.image.height);
                tripleImageIndices[2] = nextImageIndex; // 更新索引记录
                break;
        }
        
        // 清理被替换的旧纹理
        if (oldTextureToDispose) {
            oldTextureToDispose.dispose();
        }
        
        console.log(`Triple Mode: Replaced image in slot ${slot} with image ${nextImageInfo.name}. Slots now: [${tripleImageIndices[0]}, ${tripleImageIndices[1]}, ${tripleImageIndices[2]}]`);
        
        // Revoke the object URL for the loaded image after it's used
        if (nextImageInfo.isFile) URL.revokeObjectURL(nextImageInfo.source);
        
    }, undefined, function(error) {
        console.error(`Error loading texture for slot ${slot} in triple mode:`, error);
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
};