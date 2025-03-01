interface CloudItemElement extends HTMLSpanElement {
  dataset: {
    weight: string;
    __width: string;
    __height: string;
  };
}

interface CloudConfig {
  baseFontSize: number;
  fontSizeScale: number;
  imageSize: number;
  spacing: number;
  fontFamily: string;
  itemPadding: number;
  seed?: number;
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
  private goldenAngle: number = 137.508;
  private containerRect!: DOMRect;

  constructor(
    container: HTMLDivElement,
    config: Partial<CloudConfig> = {}
  ) {
    this.container = container;
    this.config = {
      baseFontSize: 16,
      fontSizeScale: 2,
      imageSize: 24,
      spacing: 10,
      fontFamily: 'Arial',
      itemPadding: 4,
      seed: 0,
      ...config,
    };

    this.initialize();
  }

  private initialize(): void {
    this.prepareDOMStructure();
    this.collectItems();
    this.precomputeSizes();
    this.adjustItemStyles();
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
      this.container.querySelectorAll<CloudItemElement>(':scope > .cloud-item')
    ).filter(el => {
      if (!el.hasAttribute('weight')) {
        console.warn('Cloud item missing weight attribute', el, el.dataset.weight);
        return false;
      }
      return true;
    });

    //?debug
    if (this.items.length === 0) {
      console.warn('No cloud items found');
      return;
    }

    // 确定性排序：先按权重降序，再按内容哈希排序
    this.items.sort((a, b) => {
      const weightDiff = Number(b.dataset.weight) - Number(a.dataset.weight);
      if (weightDiff !== 0) return weightDiff;
      return this.hash(a.textContent!) - this.hash(b.textContent!);
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
    const measurer = document.createElement('div');
    measurer.style.cssText = `
      position: absolute;
      visibility: hidden;
      left: -9999px;
      display: inline-block!important;
    `;

    this.items.forEach(item => {
      const clone = item.cloneNode(true) as CloudItemElement;
      measurer.appendChild(clone);
      const rect = clone.getBoundingClientRect();
      item.dataset.__width = `${rect.width + this.config.itemPadding * 2}`;
      item.dataset.__height = `${rect.height + this.config.itemPadding * 2}`;
      measurer.removeChild(clone);
    });

    document.body.appendChild(measurer);
    setTimeout(() => document.body.removeChild(measurer), 0);
  }

  private adjustItemStyles(): void {
    const maxWeight = Math.max(...this.items.map(
      el => Number(el.dataset.weight)));
    
    this.items.forEach(el => {
      const weight = Number(el.dataset.weight);
      const fontSize = this.config.baseFontSize + 
        (weight / maxWeight) * this.config.fontSizeScale;

      const img = el.querySelector('img');
      if (img) {
        img.style.cssText = `
          width: ${this.config.imageSize}px;
          height: ${this.config.imageSize}px;
          vertical-align: middle;
          display: inline-block!important;
        `;
      }

      const textNodes = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE);
      
      textNodes.forEach(text => {
        const wrapper = document.createElement('span');
        wrapper.style.cssText = `
          font: ${fontSize}px ${this.config.fontFamily};
          vertical-align: middle;
          display: inline-block!important;
        `;
        text.replaceWith(wrapper);
        wrapper.appendChild(text);
      });
    });
  }

  // 螺旋线
  private *spiralGenerator(attempt: number): Generator<{x: number, y: number}> {
    let radius = 2.5 * Math.sqrt(attempt);
    const angle = attempt * this.goldenAngle + this.config.seed;
    
    while (true) {
      yield {
        x: this.containerRect.width/2 + radius * Math.cos(angle * Math.PI/180),
        y: this.containerRect.height/2 + radius * Math.sin(angle * Math.PI/180)
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
      const dx = Math.abs(x - item.x);
      const dy = Math.abs(y - item.y);
      return dx < (width + item.width)/2 + this.config.spacing &&
             dy < (height + item.height)/2 + this.config.spacing;
    });
  }

  private layoutItems(): void {
    this.placedItems = [];
    const containerWidth = this.containerRect.width;
    const containerHeight = this.containerRect.height;

    this.items.forEach((el, index) => {
      const width = parseFloat(el.dataset.__width!);
      const height = parseFloat(el.dataset.__height!);
      const spiral = this.spiralGenerator(index);

      for (const {x, y} of spiral) {
        // 边界检查
        if (x - width/2 < 0 || x + width/2 > containerWidth) continue;
        if (y - height/2 < 0 || y + height/2 > containerHeight) continue;

        if (!this.checkCollision(x, y, width, height)) {
          this.applyPosition(el, x, y, width, height);
          this.placedItems.push({x, y, width, height});
          break;
        }
      }
    });

    this.container.style.height = `${containerHeight}px`;
  }

  private applyPosition(
    el: CloudItemElement,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    Object.assign(el.style, {
      position: 'absolute',
      left: `${x - width/2}px`,
      top: `${y - height/2}px`,
      width: `${width - this.config.itemPadding*2}px`,
      height: `${height - this.config.itemPadding*2}px`,
      padding: `${this.config.itemPadding}px`,
      boxSizing: 'content-box',
      transition: 'transform 0.2s',
      transform: 'translate(0,0)'
    });
  }

  public refresh(): void {
    this.containerRect = this.container.getBoundingClientRect();
    this.collectItems();
    this.precomputeSizes();
    this.layoutItems();
  }
}

export { AutoCloudLayout };

//!TODO 响应窗口变化
//window.addEventListener('resize', () => cloudLayout.refresh());