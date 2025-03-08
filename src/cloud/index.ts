interface CloudItemElement {
  el: HTMLSpanElement;
  dataset: {
    weight: number;
    __width: number;
    __height: number;
    __fontSize: string;
    __color: string;
  };
}

interface CloudConfig {
  baseFontSize: number;
  fontSizeScale: number;
  imageSize: number;
  fontFamily: string;
  itemPadding: number;
  seed?: number;
  // New option: define a font size range, e.g. [minSize, maxSize]
  sizeRange?: [number, number];
  // Add these new properties:
  colorSaturation?: number;
  lightnessRange?: [number, number];
}

class AutoCloudLayout {
  private readonly container: HTMLDivElement;
  private items: CloudItemElement[] = [];
  private config: Required<CloudConfig>;
  private placedItems: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  private placed: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private placedWidth: number = 0;
  private placedHeight: number = 0;
  private goldenAngle: number = 137.508;
  private containerRect!: DOMRect;
  private baseFontSize = 16;

  private debugMode = false;
  private debugOverlay!: HTMLCanvasElement;
  private debugInfo!: HTMLPreElement;

  // Listen for window size changes and refresh layout
  constructor(
    container: HTMLDivElement,
    config: Partial<CloudConfig> = {}
  ) {
    this.container = container;
    this.config = {
      baseFontSize: 16,
      fontSizeScale: 2,
      imageSize: 24,
      fontFamily: 'Arial',
      itemPadding: 16,
      seed: 0,
      sizeRange: [12, 36],
      colorSaturation: 90,
      lightnessRange: [40, 70],
      ...config,
    };
    this.initialize();
  }

  private initialize(): void {
    // 在构造或初始化时创建并添加调试画布
    this.debugOverlay = document.createElement('canvas');
    this.debugOverlay.style.position = 'absolute';
    this.debugOverlay.style.top = '0';
    this.debugOverlay.style.left = '0';
    this.debugOverlay.style.pointerEvents = 'none';
    this.debugInfo = document.createElement('pre');
    this.debugInfo.style.position = 'absolute';
    this.debugInfo.style.top = '0';
    this.debugInfo.style.left = '0';
    this.container.appendChild(this.debugOverlay);
    this.container.appendChild(this.debugInfo);

    this.prepareDOMStructure();
    this.collectItems();
    this.precomputeSizes();
    this.adjustItemStyles();
    const disabled = false;
    if (disabled) return;
    this.layoutItems();
  }

  private prepareDOMStructure(): void {
    this.container.classList.add('cloud');
    this.container.style.position = 'relative';
    this.container.style.overflow = 'visible';
    this.containerRect = this.container.getBoundingClientRect();
  }

  private collectItems(): void {
    this.items = Array.from(
      this.container.querySelectorAll<Element>(':scope > .cloud-item')
    ).filter(el => {
      if (!el.hasAttribute('weight')) {
        console.warn('Cloud item missing weight attribute');
        return false;
      }
      return true;
    }).map(el => ({
      el: el as HTMLSpanElement,
      dataset: {
        weight: Number(el.getAttribute('weight')),
        __width: 0,
        __height: 0,
        __fontSize: '',
        __color: ''
      }
    }));

    //?debug
    if (this.items.length === 0) {
      console.warn('No cloud items found');
      return;
    }

    // 确定性排序：先按权重降序，再按内容哈希排序
    this.items.sort((a, b) => {
      const weightDiff = Number(b.dataset.weight) - Number(a.dataset.weight);
      if (weightDiff !== 0) return weightDiff;
      return this.hash(a.el.textContent!) - this.hash(b.el.textContent!);
    });
  }

  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return hash;
  }

  private precomputeSizes(): void {
    this.items.forEach(item => {
      item.dataset.weight = Number(item.dataset.weight);
      const rect = item.el.getBoundingClientRect();
      item.dataset.__width = rect.width;
      item.dataset.__height = rect.height;
    });
  }

  private adjustItemStyles(): void {
    const weights = this.items.map(item => item.dataset.weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const weightRange = maxWeight - minWeight || 1;
    // Use the configured sizeRange; fallback to baseFontSize + fontSizeScale if not provided
    const [minFont, maxFont] = this.config.sizeRange!
      || [this.config.baseFontSize, this.config.baseFontSize + this.config.fontSizeScale];

    this.items.forEach(item => {
      const weight = Number(item.dataset.weight);
      const normalized = (weight - minWeight) / weightRange;
      //get original fontSize
      const fontSize = parseFloat(window.getComputedStyle(item.el).fontSize);
      const computedFontSize = minFont + normalized * (maxFont - minFont);
      const hashVal = this.hash(item.el.textContent || '');
      const computedColor = this.generateVibrantColor(hashVal, normalized);
      const scale = computedFontSize / fontSize;
      
      item.dataset.__width *= scale;
      item.dataset.__height *= scale;

      // el.style.cssText = `
      //   width: ${this.config.imageSize}px;
      //   height: ${this.config.imageSize}px;
      //   font: ${computedFontSize}px ${this.config.fontFamily};
      //   color: ${computedColor};
      //   vertical-align: middle;
      //   display: inline-block!important;
      // `;
      // 只负责计算，把值暂存在 dataset
      item.el.dataset.__fontSize = String(computedFontSize);
      item.el.dataset.__color = computedColor;
    });
  }

  // Generates a deterministic vibrant color based on the item’s text and its normalized weight.
  private generateVibrantColor(hashVal: number, normalized: number): string {
    const hue = Math.abs(hashVal) % 360;
    const saturation = this.config.colorSaturation;
    const [minL, maxL] = this.config.lightnessRange;
    const lightness = minL + normalized * (maxL - minL);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  // 螺旋线
  //!现在的算法是，在螺旋线上连续取n个点，然后检查是否有碰撞，如果有则向外加0.5半径
  private *spiralGenerator(attempt: number): Generator<{ x: number, y: number }> {
    let radius = 2.5 * Math.sqrt(attempt);
    const angle = attempt * this.goldenAngle + this.config.seed;

    while (true) {
      yield {
        x: radius * Math.cos(angle * Math.PI / 180),
        y: radius * Math.sin(angle * Math.PI / 180)
      };
      radius += 0.5;
    }
  }

  private checkCollision(
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    return this.placedItems.some(item => {
      const dx = Math.abs(x + width / 2 - item.x - item.width / 2);
      const dy = Math.abs(y + height / 2 - item.y - item.height / 2);
      return dx < (width + item.width) / 2 + this.config.itemPadding * 2 &&
        dy < (height + item.height) / 2 + this.config.itemPadding * 2;
    });
  }

  // After all items are positioned, set the container's fontSize
  private layoutItems(): void {
    this.placedItems = [];

    // 用于统计所有放置后的 item 的最小/最大坐标
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const containerWidth = this.containerRect.width;
    const containerHeight = this.containerRect.height;

    // 先按原逻辑把 item 计算并存入 placedItems
    this.items.forEach((el, index) => {
      const width = el.dataset.__width!;
      const height = el.dataset.__height!;
      const spiral = this.spiralGenerator(index);

      for (const { x, y } of spiral) {
        if (!this.checkCollision(x, y, width, height)) {
          this.applyPosition(el, x, y, width, height);
          this.placedItems.push({ x, y, width, height });

          // 更新边界统计
          const left = x - this.config.itemPadding;
          const top = y - this.config.itemPadding;
          const right = x + width + this.config.itemPadding;
          const bottom = y + height + this.config.itemPadding;
          if (left < minX) minX = left;
          if (top < minY) minY = top;
          if (right > maxX) maxX = right;
          if (bottom > maxY) maxY = bottom;
          break;
        }
      }
    });

    // 根据边界计算所需缩放和平移，让所有 item 都能包含在内部
    this.placed = { minX, minY, maxX, maxY };
    this.placedWidth = maxX - minX;
    this.placedHeight = maxY - minY;
    this.placedItems.map(item => {
      item.x -= minX;
      item.y -= minY;
      return item;
    });
    
    this.container.style.width = this.placedWidth + 'px';
    this.container.style.height = this.placedHeight + 'px';

    // 这里可以对所有 item 做统一缩放/平移
    this.placedItems.forEach((item, i) => {
      this.applyPosition(this.items[i], item.x, item.y, item.width, item.height);
    });
  }

  // Convert px to em and explicitly set position using em units
  private applyPosition(
    item: CloudItemElement,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const el = item.el;
    const leftPx = x;
    const topPx = y;
    const wPx = width;
    const hPx = height;

    const fontSizePx = parseFloat(el.dataset.__fontSize!);
    const color = el.dataset.__color!;

    Object.assign(el.style, {
      position: 'absolute',
      left: `${leftPx}px`,
      top: `${topPx}px`,
      width: `${wPx}px`,
      height: `${hPx}px`,
      padding: `${this.config.itemPadding}px`,
      boxSizing: 'content-box',
      transition: 'transform 0.2s',
      fontSize: `${fontSizePx}px`,
      color,
    });

    // 如果需要强制 inline-block，可以这样：
    el.style.setProperty('display', 'inline-block', 'important');

  }

  private debugIntervalId: number | null = null;

  // 切换调试模式
  public toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    if (this.debugMode) {
      // 清除可能存在的旧定时器
      if (this.debugIntervalId !== null) {
        clearInterval(this.debugIntervalId);
        this.debugIntervalId = null;
      }

      this.drawDebug();

      // 创建新定时器并保存ID
      this.debugIntervalId = setInterval(() => {
        this.debugInfo.textContent = `info: container ${this.containerRect.width} x ${this.containerRect.height} content ${this.placedWidth} x ${this.placedHeight}\n
        ${this.placed.minX} ~ ${this.placed.maxX} ${this.placed.minY} ~ ${this.placed.maxY}
        `;
      }, 100);

      this.container.style.backgroundColor = 'rgba(0,0,1,0.2)';
    } else {
      const ctx = this.debugOverlay.getContext('2d');
      ctx && ctx.clearRect(0, 0, this.debugOverlay.width, this.debugOverlay.height);

      // 清除定时器并重置ID
      if (this.debugIntervalId !== null) {
        clearInterval(this.debugIntervalId);
        this.debugIntervalId = null;
      }

      // 立即清空调试信息
      this.debugInfo.textContent = '';
      this.container.style.backgroundColor = '';
    }
  }

  // 绘制调试信息：螺旋轨迹、放置区域
  private drawDebug(): void {
    if (!this.debugMode) return;
    const ctx = this.debugOverlay.getContext('2d');
    if (!ctx) return;

    // 调整画布至容器大小
    this.debugOverlay.width = this.containerRect.width;
    this.debugOverlay.height = this.containerRect.height;

    // 1. 绘制所有已放置 item 的外框
    ctx.strokeStyle = 'red';
    this.placedItems.forEach(({ x, y, width, height }) => {
      ctx.strokeRect(
        x + this.config.itemPadding,
        y + this.config.itemPadding,
        width,
        height
      );
    });
    console.log(this.placedItems);

    // 2. 简单展示螺旋探测位置（示例：某个 item 的探测整体）
    ctx.strokeStyle = 'blue';
    const sampleSpiral = this.spiralGenerator(0); // 仅示例
    let steps = 0;
    for (const { x, y } of sampleSpiral) {
      ctx.beginPath();
      //ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.lineTo(x, y);
      ctx.stroke();
      steps++;
      if (steps > 100) break; // 避免绘制过多
    }
  }
}

export { AutoCloudLayout };