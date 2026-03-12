(async () => {
  const STORAGE_KEY = "siteSettings";
  const VIEWER_ID = "codex-xhs-zoom-viewer";
  const STYLE_ACTIVE_CLASS = "codex-xhs-zoom-lock";
  const MAX_SCALE = 6;
  const MIN_SCALE = 1;
  const SCALE_STEP = 0.18;
  const CLICK_MOVE_TOLERANCE = 8;
  const NAVIGATION_WHEEL_THRESHOLD = 60;
  let settings = await loadSettings();

  if (!isEnabledForCurrentSite(settings, window.location.hostname)) {
    return;
  }

  let viewerState = null;

  document.addEventListener("click", onDocumentClick, true);
  window.addEventListener("keydown", onDocumentKeydown, true);

  function onDocumentClick(event) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    const image = findEligibleImage(event);
    if (!image) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openViewer(image);
  }

  function onDocumentKeydown(event) {
    if (!viewerState) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeViewer();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showSiblingImage(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showSiblingImage(1);
    }
  }

  function findEligibleImage(event) {
    const path = event.composedPath();

    for (const node of path) {
      if (!(node instanceof HTMLImageElement)) {
        continue;
      }

      if (node.closest(`#${VIEWER_ID}`)) {
        continue;
      }

      if (!node.closest("main, section, article, div")) {
        continue;
      }

      if (!isVisible(node) || !isLargeEnough(node)) {
        continue;
      }

      return node;
    }

    return null;
  }

  function isVisible(node) {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isLargeEnough(node) {
    const rect = node.getBoundingClientRect();
    return rect.width >= 120 && rect.height >= 120;
  }

  function openViewer(sourceImage) {
    closeViewer();

    const imageGroup = collectImageGroup(sourceImage);
    if (imageGroup.urls.length === 0) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = VIEWER_ID;
    overlay.className = "codex-xhs-zoom-overlay";

    const backdrop = document.createElement("div");
    backdrop.className = "codex-xhs-zoom-backdrop";

    const toolbar = document.createElement("div");
    toolbar.className = "codex-xhs-zoom-toolbar";

    const hint = document.createElement("div");
    hint.className = "codex-xhs-zoom-hint";
    hint.textContent = "滚轮在图上缩放，在图外切图，Esc 退出";

    const counter = document.createElement("div");
    counter.className = "codex-xhs-zoom-counter";

    const settingsButton = document.createElement("button");
    settingsButton.type = "button";
    settingsButton.className = "codex-xhs-zoom-settings";
    settingsButton.setAttribute("aria-label", "Open site rules");
    settingsButton.innerHTML = '<span class="codex-xhs-zoom-settings-glyph" aria-hidden="true">⚙</span>';

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "codex-xhs-zoom-close";
    closeButton.setAttribute("aria-label", "Close image viewer");
    closeButton.textContent = "×";

    const toolbarActions = document.createElement("div");
    toolbarActions.className = "codex-xhs-zoom-toolbar-actions";

    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "codex-xhs-zoom-nav codex-xhs-zoom-nav-left";
    prevButton.setAttribute("aria-label", "Previous image");
    prevButton.innerHTML = '<span class="codex-xhs-zoom-nav-glyph" aria-hidden="true">‹</span>';

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "codex-xhs-zoom-nav codex-xhs-zoom-nav-right";
    nextButton.setAttribute("aria-label", "Next image");
    nextButton.innerHTML = '<span class="codex-xhs-zoom-nav-glyph" aria-hidden="true">›</span>';

    const stage = document.createElement("div");
    stage.className = "codex-xhs-zoom-stage";

    const viewport = document.createElement("div");
    viewport.className = "codex-xhs-zoom-viewport";

    const settingsPanel = document.createElement("aside");
    settingsPanel.className = "codex-xhs-zoom-settings-panel";
    settingsPanel.hidden = true;

    const settingsPanelTitle = document.createElement("h2");
    settingsPanelTitle.className = "codex-xhs-zoom-settings-title";
    settingsPanelTitle.textContent = "站点规则";

    const settingsPanelIntro = document.createElement("p");
    settingsPanelIntro.className = "codex-xhs-zoom-settings-intro";
    settingsPanelIntro.textContent = "默认使用白名单，并预置小红书。你也可以切换成黑名单模式。";

    const modeLabel = document.createElement("label");
    modeLabel.className = "codex-xhs-zoom-settings-field";
    const modeText = document.createElement("span");
    modeText.textContent = "模式";
    const modeSelect = document.createElement("select");
    modeSelect.className = "codex-xhs-zoom-settings-select";
    modeSelect.innerHTML =
      '<option value="whitelist">白名单：仅在这些站点启用</option>' +
      '<option value="blacklist">黑名单：除这些站点外都启用</option>';
    modeLabel.append(modeText, modeSelect);

    const patternsLabel = document.createElement("label");
    patternsLabel.className = "codex-xhs-zoom-settings-field";
    const patternsText = document.createElement("span");
    patternsText.textContent = "域名列表";
    const patternsInput = document.createElement("textarea");
    patternsInput.className = "codex-xhs-zoom-settings-textarea";
    patternsInput.rows = 8;
    patternsInput.spellcheck = false;
    patternsInput.placeholder = "每行一个域名，例如\nexample.com\n*.example.com";
    patternsLabel.append(patternsText, patternsInput);

    const supportLink = document.createElement("a");
    supportLink.className = "codex-xhs-zoom-settings-link";
    supportLink.href = "https://github.com/yusen0723/image-viewer/";
    supportLink.target = "_blank";
    supportLink.rel = "noopener noreferrer";
    supportLink.textContent = "如果这个扩展对你有帮助，欢迎去 GitHub 给项目点个 Star。";

    const settingsActions = document.createElement("div");
    settingsActions.className = "codex-xhs-zoom-settings-actions";
    const settingsStatus = document.createElement("span");
    settingsStatus.className = "codex-xhs-zoom-settings-status";
    const settingsSaveButton = document.createElement("button");
    settingsSaveButton.type = "button";
    settingsSaveButton.className = "codex-xhs-zoom-settings-save";
    settingsSaveButton.textContent = "保存";
    settingsActions.append(settingsStatus, settingsSaveButton);

    settingsPanel.append(
      settingsPanelTitle,
      settingsPanelIntro,
      modeLabel,
      patternsLabel,
      supportLink,
      settingsActions
    );

    const image = document.createElement("img");
    image.className = "codex-xhs-zoom-image";
    image.alt = sourceImage.alt || "Preview image";
    image.draggable = false;

    toolbarActions.append(counter, settingsButton, closeButton);
    toolbar.append(hint, toolbarActions);
    viewport.appendChild(image);
    stage.append(prevButton, viewport, nextButton, settingsPanel);
    overlay.append(backdrop, toolbar, stage);
    document.documentElement.appendChild(overlay);
    document.documentElement.classList.add(STYLE_ACTIVE_CLASS);

    viewerState = {
      overlay,
      stage,
      viewport,
      image,
      counter,
      settingsButton,
      settingsPanel,
      modeSelect,
      patternsInput,
      settingsStatus,
      settingsSaveButton,
      prevButton,
      nextButton,
      imageUrls: imageGroup.urls,
      currentIndex: imageGroup.index,
      scale: 1,
      translateX: 0,
      translateY: 0,
      isPointerDown: false,
      dragStartX: 0,
      dragStartY: 0,
      dragOriginX: 0,
      dragOriginY: 0,
      hasDragged: false,
      suppressNextClick: false,
      detachViewportSync: null,
      wheelNavigationRemainder: 0
    };

    overlay.addEventListener("wheel", onViewerWheel, { passive: false });
    backdrop.addEventListener("click", closeViewer);
    closeButton.addEventListener("click", closeViewer);
    settingsButton.addEventListener("click", toggleSettingsPanel);
    settingsSaveButton.addEventListener("click", saveSettingsFromPanel);
    prevButton.addEventListener("click", () => showSiblingImage(-1));
    nextButton.addEventListener("click", () => showSiblingImage(1));
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    image.addEventListener("dragstart", (event) => event.preventDefault());
    overlay.addEventListener("click", onOverlayClick);
    image.addEventListener("load", resetTransform);
    viewerState.detachViewportSync = syncOverlayToViewport();

    syncSettingsPanel();
    renderCurrentImage();
  }

  function closeViewer() {
    if (!viewerState) {
      return;
    }

    if (viewerState.detachViewportSync) {
      viewerState.detachViewportSync();
    }
    viewerState.overlay.remove();
    viewerState = null;
    document.documentElement.classList.remove(STYLE_ACTIVE_CLASS);
  }

  function onOverlayClick(event) {
    if (!viewerState) {
      return;
    }

    if (viewerState.suppressNextClick) {
      viewerState.suppressNextClick = false;
      event.stopPropagation();
      return;
    }

    const clickedInsideImage = event.target === viewerState.image;
    const clickedControl = event.target.closest(
      ".codex-xhs-zoom-nav, .codex-xhs-zoom-close, .codex-xhs-zoom-toolbar, .codex-xhs-zoom-counter"
      + ", .codex-xhs-zoom-settings"
    );
    const clickedSettingsPanel = event.target.closest(".codex-xhs-zoom-settings-panel");
    if (clickedInsideImage || clickedControl) {
      event.stopPropagation();
      return;
    }

    if (clickedSettingsPanel) {
      event.stopPropagation();
      return;
    }

    closeViewer();
  }

  function onViewerWheel(event) {
    if (!viewerState) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!isPointerOverImage(event.clientX, event.clientY)) {
      handleWheelNavigation(event);
      return;
    }

    const delta = normalizeZoomWheelDelta(event);
    if (delta === 0) {
      return;
    }

    const nextScale = clamp(
      viewerState.scale * (1 + delta * SCALE_STEP),
      MIN_SCALE,
      MAX_SCALE
    );
    zoomAroundPoint(nextScale, event.clientX, event.clientY);
  }

  function handleWheelNavigation(event) {
    if (!viewerState || viewerState.imageUrls.length <= 1) {
      return;
    }

    viewerState.wheelNavigationRemainder += event.deltaY;

    if (viewerState.wheelNavigationRemainder >= NAVIGATION_WHEEL_THRESHOLD) {
      viewerState.wheelNavigationRemainder = 0;
      showSiblingImage(1);
      return;
    }

    if (viewerState.wheelNavigationRemainder <= -NAVIGATION_WHEEL_THRESHOLD) {
      viewerState.wheelNavigationRemainder = 0;
      showSiblingImage(-1);
    }
  }

  function onPointerDown(event) {
    if (!viewerState || viewerState.scale <= 1) {
      return;
    }

    viewerState.isPointerDown = true;
    viewerState.hasDragged = false;
    viewerState.dragStartX = event.clientX;
    viewerState.dragStartY = event.clientY;
    viewerState.dragOriginX = viewerState.translateX;
    viewerState.dragOriginY = viewerState.translateY;
    viewerState.stage.setPointerCapture(event.pointerId);
    viewerState.stage.classList.add("is-dragging");
  }

  function onPointerMove(event) {
    if (!viewerState || !viewerState.isPointerDown) {
      return;
    }

    const deltaX = event.clientX - viewerState.dragStartX;
    const deltaY = event.clientY - viewerState.dragStartY;

    if (Math.abs(deltaX) > CLICK_MOVE_TOLERANCE || Math.abs(deltaY) > CLICK_MOVE_TOLERANCE) {
      viewerState.hasDragged = true;
    }

    viewerState.translateX = viewerState.dragOriginX + deltaX;
    viewerState.translateY = viewerState.dragOriginY + deltaY;
    clampTranslation();
    renderTransform();
  }

  function onPointerUp(event) {
    if (!viewerState) {
      return;
    }

    if (viewerState.isPointerDown) {
      if (viewerState.hasDragged) {
        viewerState.suppressNextClick = true;
      }
      viewerState.isPointerDown = false;
      viewerState.stage.classList.remove("is-dragging");
      if (viewerState.stage.hasPointerCapture(event.pointerId)) {
        viewerState.stage.releasePointerCapture(event.pointerId);
      }
    }
  }

  function showSiblingImage(direction) {
    if (!viewerState || viewerState.imageUrls.length <= 1) {
      return;
    }

    const lastIndex = viewerState.imageUrls.length - 1;
    viewerState.currentIndex = clamp(viewerState.currentIndex + direction, 0, lastIndex);
    viewerState.wheelNavigationRemainder = 0;
    renderCurrentImage();
  }

  function toggleSettingsPanel() {
    if (!viewerState) {
      return;
    }

    const isHidden = viewerState.settingsPanel.hidden;
    viewerState.settingsPanel.hidden = !isHidden;
    viewerState.settingsButton.classList.toggle("is-active", isHidden);
    if (isHidden) {
      syncSettingsPanel();
    }
  }

  function syncSettingsPanel() {
    if (!viewerState) {
      return;
    }

    viewerState.modeSelect.value = settings.mode || "whitelist";
    viewerState.patternsInput.value = (settings.patterns || []).join("\n");
    viewerState.settingsStatus.textContent = "";
  }

  function saveSettingsFromPanel() {
    if (!viewerState) {
      return;
    }

    const nextSettings = {
      mode: viewerState.modeSelect.value,
      patterns: viewerState.patternsInput.value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
    };

    chrome.storage.sync.set({ [STORAGE_KEY]: nextSettings }, () => {
      settings = nextSettings;
      viewerState.settingsStatus.textContent = "已保存";
      window.setTimeout(() => {
        if (viewerState) {
          viewerState.settingsStatus.textContent = "";
        }
      }, 1500);
    });
  }

  function zoomAroundPoint(nextScale, clientX, clientY) {
    if (!viewerState) {
      return;
    }

    const rect = viewerState.stage.getBoundingClientRect();
    const originX = clientX - rect.left - rect.width / 2;
    const originY = clientY - rect.top - rect.height / 2;
    const ratio = nextScale / viewerState.scale;

    viewerState.translateX = originX - (originX - viewerState.translateX) * ratio;
    viewerState.translateY = originY - (originY - viewerState.translateY) * ratio;
    viewerState.scale = nextScale;

    if (viewerState.scale === 1) {
      viewerState.translateX = 0;
      viewerState.translateY = 0;
    } else {
      clampTranslation();
    }

    renderTransform();
  }

  function clampTranslation() {
    if (!viewerState) {
      return;
    }

    const stageRect = viewerState.stage.getBoundingClientRect();
    const imageRect = getBaseImageRect();
    if (!imageRect) {
      return;
    }

    const scaledWidth = imageRect.width * viewerState.scale;
    const scaledHeight = imageRect.height * viewerState.scale;
    const maxX = Math.max(0, (scaledWidth - stageRect.width) / 2);
    const maxY = Math.max(0, (scaledHeight - stageRect.height) / 2);

    viewerState.translateX = clamp(viewerState.translateX, -maxX, maxX);
    viewerState.translateY = clamp(viewerState.translateY, -maxY, maxY);
  }

  function getBaseImageRect() {
    if (!viewerState) {
      return null;
    }

    const naturalWidth = viewerState.image.naturalWidth || 1;
    const naturalHeight = viewerState.image.naturalHeight || 1;
    const stageRect = viewerState.stage.getBoundingClientRect();
    const stageRatio = stageRect.width / stageRect.height;
    const imageRatio = naturalWidth / naturalHeight;

    if (imageRatio > stageRatio) {
      const width = stageRect.width;
      return {
        width,
        height: width / imageRatio
      };
    }

    const height = stageRect.height;
    return {
      width: height * imageRatio,
      height
    };
  }

  function renderTransform() {
    if (!viewerState) {
      return;
    }

    viewerState.stage.classList.toggle("is-zoomed", viewerState.scale > 1);
    viewerState.image.style.transform =
      `translate(${viewerState.translateX}px, ${viewerState.translateY}px) scale(${viewerState.scale})`;
  }

  function renderCurrentImage() {
    if (!viewerState) {
      return;
    }

    const currentUrl = viewerState.imageUrls[viewerState.currentIndex];
    if (!currentUrl) {
      return;
    }

    viewerState.counter.textContent = `${viewerState.currentIndex + 1} / ${viewerState.imageUrls.length}`;
    viewerState.prevButton.disabled = viewerState.currentIndex === 0;
    viewerState.nextButton.disabled = viewerState.currentIndex === viewerState.imageUrls.length - 1;
    resetTransform();

    if (viewerState.image.src !== currentUrl) {
      viewerState.image.src = currentUrl;
    }
  }

  function syncOverlayToViewport() {
    const applyViewportMetrics = () => {
      if (!viewerState) {
        return;
      }

      const viewport = window.visualViewport;
      if (!viewport) {
        viewerState.overlay.style.removeProperty("width");
        viewerState.overlay.style.removeProperty("height");
        viewerState.overlay.style.removeProperty("left");
        viewerState.overlay.style.removeProperty("top");
        return;
      }

      viewerState.overlay.style.left = `${viewport.offsetLeft}px`;
      viewerState.overlay.style.top = `${viewport.offsetTop}px`;
      viewerState.overlay.style.width = `${viewport.width}px`;
      viewerState.overlay.style.height = `${viewport.height}px`;
      clampTranslation();
      renderTransform();
    };

    applyViewportMetrics();

    if (!window.visualViewport) {
      window.addEventListener("resize", applyViewportMetrics);
      return () => window.removeEventListener("resize", applyViewportMetrics);
    }

    window.visualViewport.addEventListener("resize", applyViewportMetrics);
    window.visualViewport.addEventListener("scroll", applyViewportMetrics);
    window.addEventListener("resize", applyViewportMetrics);

    return () => {
      if (!window.visualViewport) {
        window.removeEventListener("resize", applyViewportMetrics);
        return;
      }

      window.visualViewport.removeEventListener("resize", applyViewportMetrics);
      window.visualViewport.removeEventListener("scroll", applyViewportMetrics);
      window.removeEventListener("resize", applyViewportMetrics);
    };
  }

  function resetTransform() {
    if (!viewerState) {
      return;
    }

    viewerState.scale = 1;
    viewerState.translateX = 0;
    viewerState.translateY = 0;
    renderTransform();
  }

  function getBestImageUrl(image) {
    const candidates = [];

    if (image.currentSrc) {
      candidates.push(image.currentSrc);
    }

    if (image.src) {
      candidates.push(image.src);
    }

    const dataKeys = ["src", "originSrc", "originalSrc", "lazySrc"];
    for (const key of dataKeys) {
      const value = image.dataset[key];
      if (value) {
        candidates.push(value);
      }
    }

    return candidates
      .map(normalizeImageUrl)
      .find(Boolean) || null;
  }

  function collectImageGroup(sourceImage) {
    const siteSpecificGroup = collectSiteSpecificImageGroup(sourceImage);
    if (siteSpecificGroup) {
      return siteSpecificGroup;
    }

    const container = findImageGroupContainer(sourceImage);
    const candidates = Array.from(container.querySelectorAll("img"))
      .filter((node) => isVisible(node) && isLargeEnough(node))
      .sort(compareImagesByVisualOrder)
      .map((node) => ({
        node,
        url: getBestImageUrl(node)
      }))
      .filter((item) => Boolean(item.url));

    const deduped = [];
    const seen = new Map();
    for (const item of candidates) {
      if (!seen.has(item.url)) {
        seen.set(item.url, deduped.length);
        deduped.push(item);
        continue;
      }

      // Keep the clicked image as the representative item for its URL so the
      // initial index doesn't snap back to the first duplicate occurrence.
      if (item.node === sourceImage) {
        const existingIndex = seen.get(item.url);
        deduped[existingIndex] = item;
      }
    }

    const urls = deduped.map((item) => item.url);
    const sourceUrl = getBestImageUrl(sourceImage);
    const index = Math.max(
      0,
      deduped.findIndex((item) => item.node === sourceImage || item.url === sourceUrl)
    );

    return { urls, index };
  }

  function findImageGroupContainer(sourceImage) {
    let current = sourceImage.parentElement;

    while (current && current !== document.body) {
      const images = Array.from(current.querySelectorAll("img"))
        .filter((node) => isVisible(node) && isLargeEnough(node));
      if (images.length > 1 && current.getBoundingClientRect().width > 0) {
        return current;
      }
      current = current.parentElement;
    }

    return sourceImage.parentElement || document.body;
  }

  function collectSiteSpecificImageGroup(sourceImage) {
    if (!isXiaohongshuHost(window.location.hostname)) {
      return null;
    }

    const carousel = sourceImage.closest(
      '[class*="swiper"], [class*="Swiper"], [class*="carousel"], [class*="Carousel"]'
    );
    if (!carousel) {
      return null;
    }

    const slideNodes = Array.from(
      carousel.querySelectorAll(
        '[class*="swiper-slide"], [class*="SwiperSlide"], [data-swiper-slide-index], [class*="slick-slide"]'
      )
    );
    if (slideNodes.length === 0) {
      return null;
    }

    const sourceUrl = getBestImageUrl(sourceImage);
    const items = [];
    const seenSlideKeys = new Set();
    for (const slide of slideNodes) {
      const image = slide.contains(sourceImage)
        ? sourceImage
        : Array.from(slide.querySelectorAll("img")).find((node) => isVisible(node) && isLargeEnough(node));
      if (!image) {
        continue;
      }

      const url = getBestImageUrl(image);
      if (!url) {
        continue;
      }

      const slideKey = getSlideIdentity(slide, url);
      if (seenSlideKeys.has(slideKey)) {
        continue;
      }

      seenSlideKeys.add(slideKey);
      items.push({
        node: image,
        url,
        order: getSlideOrder(slide, items.length)
      });
    }

    if (items.length <= 1) {
      return null;
    }

    items.sort((a, b) => a.order - b.order);

    return {
      urls: items.map((item) => item.url),
      index: Math.max(0, items.findIndex((item) => item.node === sourceImage || item.url === sourceUrl))
    };
  }

  function isXiaohongshuHost(hostname) {
    return hostname === "xiaohongshu.com"
      || hostname.endsWith(".xiaohongshu.com")
      || hostname === "xiaohongshu.net"
      || hostname.endsWith(".xiaohongshu.net");
  }

  function getSlideIdentity(slide, fallbackUrl) {
    if (slide.dataset.swiperSlideIndex) {
      return `swiper:${slide.dataset.swiperSlideIndex}`;
    }

    const match = Array.from(slide.classList)
      .map((className) => className.match(/(?:^|-)slide-(\d+)(?:-|$)/i))
      .find(Boolean);
    if (match) {
      return `class:${match[1]}`;
    }

    return `url:${fallbackUrl}`;
  }

  function getSlideOrder(slide, fallbackOrder) {
    if (slide.dataset.swiperSlideIndex) {
      const numericIndex = Number.parseInt(slide.dataset.swiperSlideIndex, 10);
      if (!Number.isNaN(numericIndex)) {
        return numericIndex;
      }
    }

    return fallbackOrder;
  }

  function compareImagesByVisualOrder(a, b) {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    const sameRow = Math.abs(rectA.top - rectB.top) < 12;

    if (!sameRow) {
      return rectA.top - rectB.top;
    }

    return rectA.left - rectB.left;
  }

  function normalizeImageUrl(url) {
    if (!url) {
      return null;
    }

    try {
      const parsed = new URL(url, window.location.href);

      if (parsed.protocol.startsWith("http")) {
        parsed.searchParams.delete("imageView2");
        parsed.searchParams.delete("x-oss-process");
      }

      return parsed.toString();
    } catch {
      return url;
    }
  }

  function normalizeZoomWheelDelta(event) {
    if (event.deltaY === 0) {
      return 0;
    }

    const direction = event.deltaY < 0 ? 1 : -1;
    const intensity = Math.min(Math.abs(event.deltaY) / 100, 1.5);
    return direction * Math.max(0.35, intensity);
  }

  function isPointerOverImage(clientX, clientY) {
    if (!viewerState) {
      return false;
    }

    const rect = viewerState.image.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isEnabledForCurrentSite(allSettings, hostname) {
    const mode = allSettings.mode || "whitelist";
    const patterns = (allSettings.patterns || [])
      .map((item) => item.trim())
      .filter(Boolean);

    const matched = patterns.some((pattern) => matchesHostname(pattern, hostname));
    return mode === "blacklist" ? !matched : matched;
  }

  function matchesHostname(pattern, hostname) {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(2);
      return hostname === suffix || hostname.endsWith(`.${suffix}`);
    }

    return hostname === pattern || hostname.endsWith(`.${pattern}`);
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          [STORAGE_KEY]: {
            mode: "whitelist",
            patterns: ["xiaohongshu.com"]
          }
        },
        (result) => resolve(result[STORAGE_KEY])
      );
    });
  }
})();
