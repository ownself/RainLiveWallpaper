// transition.js

// 淡入淡出过渡效果管理器
class FadeTransition {
  constructor(scene, camera, renderer, material) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.material = material;

    // 创建第二个材质和网格用于过渡
    this.transitionMaterial = material.clone();
    this.transitionQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), this.transitionMaterial);
    this.transitionQuad.visible = false;
    this.scene.add(this.transitionQuad);

    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.transitionDuration = 1000; // 过渡持续时间 (毫秒)
  }

  // 开始过渡到新纹理
  startTransition(newTexture, newTextureResolution) {
    if (this.isTransitioning) {
      console.warn("Transition already in progress, skipping.");
      return;
    }

    // 设置过渡材质的纹理
    this.transitionMaterial.uniforms.u_tex0 = { value: newTexture };
    this.transitionMaterial.uniforms.u_tex0_resolution = { value: newTextureResolution };

    // 重置过渡状态
    this.transitionProgress = 0;
    this.isTransitioning = true;
    this.transitionQuad.visible = true;

    // 保存当前主材质的纹理引用，以便在结束后清理
    this.oldTexture = this.material.uniforms.u_tex0.value;

    // 开始动画循环
    this.animateTransition();
  }

  // 动画循环
  animateTransition() {
    if (!this.isTransitioning) return;

    const progress = Math.min(1, this.transitionProgress / this.transitionDuration);
    
    // 更新过渡材质的透明度 (淡入)
    this.transitionMaterial.uniforms.u_brightness.value = progress;
    
    // 更新主材质的透明度 (淡出)
    this.material.uniforms.u_brightness.value = 1.0 - progress;

    this.transitionProgress += 16; // 假设60fps, 16ms per frame

    if (progress < 1) {
      requestAnimationFrame(() => this.animateTransition());
    } else {
      this.finishTransition();
    }
  }

  // 完成过渡
  finishTransition() {
    // 将新纹理设置为主材质
    this.material.uniforms.u_tex0 = { value: this.transitionMaterial.uniforms.u_tex0.value };
    this.material.uniforms.u_tex0_resolution = { value: this.transitionMaterial.uniforms.u_tex0_resolution.value };
    
    // 重置亮度
    this.material.uniforms.u_brightness.value = 1.0;
    
    // 清理旧纹理
    if (this.oldTexture) {
      this.oldTexture.dispose();
      this.oldTexture = null;
    }

    // 隐藏过渡网格
    this.transitionQuad.visible = false;
    this.isTransitioning = false;
  }
}
