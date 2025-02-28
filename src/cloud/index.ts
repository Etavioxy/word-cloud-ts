interface CloudItemElement extends HTMLSpanElement {
  dataset: {
    weight: string;
    // 可扩展其他数据属性
  };
}

interface CloudConfig {
  baseFontSize: number;
  fontSizeScale: number;
  imageSize: number;
  horizontalGap: number;
  verticalGap: number;
  fontFamily: string;
  textColor: string;
  itemPadding: number;
}

class AutoCloudLayout {
  private readonly container: HTMLDivElement;
  private items: CloudItemElement[] = [];
  private config: Required<CloudConfig>;

  constructor(
    container: HTMLDivElement,
    config: Partial<CloudConfig> = {}
  ) {
    this.container = container;
    this.config = {
      baseFontSize: 16,
      fontSizeScale: 2,
      imageSize: 24,
      horizontalGap: 10,
      verticalGap: 15,
      fontFamily: 'Arial',
      textColor: '#333',
      itemPadding: 4,
      ...config,
    };

    this.initialize();
  }

  private initialize(): void {
    this.prepareDOMStructure();
    this.collectItems();
    this.adjustItemStyles();
    this.layoutItems();
  }

  // 验证并准备基础DOM结构
  private prepareDOMStructure(): void {
    this.container.classList.add('cloud');
    this.container.style.position = 'relative';
    this.container.style.lineHeight = '0';
  }

  // 收集并验证子元素
  private collectItems(): void {
    this.items = Array.from(
      this.container.querySelectorAll<CloudItemElement>(':scope > .cloud-item')
    ).filter(el => {
      if (!el.hasAttribute('weight')) {
        console.warn('Cloud item missing weight attribute', el);
        return false;
      }
      return true;
    });

    // 按权重降序排序
    this.items.sort((a, b) => 
      Number(b.dataset.weight) - Number(a.dataset.weight));
  }

  // 根据权重调整样式
  private adjustItemStyles(): void {
    const maxWeight = Math.max(...this.items.map(
      el => Number(el.dataset.weight)));
    
    this.items.forEach(el => {
      const weight = Number(el.dataset.weight);
      const fontSize = this.config.baseFontSize + 
        (weight / maxWeight) * this.config.fontSizeScale;

      // 查找内部元素
      const img = el.querySelector('img');
      const text = Array.from(el.childNodes)
        .find(n => n.nodeType === Node.TEXT_NODE);

      // 设置图片样式
      if (img) {
        img.style.width = `${this.config.imageSize}px`;
        img.style.height = `${this.config.imageSize}px`;
        img.style.verticalAlign = 'middle';
      }

      // 设置文字样式
      if (text && text.textContent?.trim()) {
        const wrapper = document.createElement('span');
        wrapper.style.font = `${fontSize}px ${this.config.fontFamily}`;
        wrapper.style.color = this.config.textColor;
        wrapper.style.verticalAlign = 'middle';
        text.replaceWith(wrapper);
        wrapper.appendChild(text);
      }
    });
  }

  private measureItems(): { width: number; height: number }[] {
    // 创建测量容器
    const measuringContainer = this.container.cloneNode() as HTMLDivElement;
    measuringContainer.style.visibility = 'hidden';
    measuringContainer.style.position = 'absolute';
    measuringContainer.style.left = '-9999px';
    document.body.appendChild(measuringContainer);

    // 克隆元素进行测量
    const clones = this.items.map(el => {
      const clone = el.cloneNode(true) as CloudItemElement;
      clone.style.display = 'inline-block';
      clone.style.position = 'static';
      measuringContainer.appendChild(clone);
      return clone;
    });

    // 获取测量结果
    const measurements = clones.map(clone => {
      const rect = clone.getBoundingClientRect();
      return {
        width: rect.width + this.config.itemPadding * 2,
        height: rect.height + this.config.itemPadding * 2
      };
    });

    // 清理测量环境
    document.body.removeChild(measuringContainer);
    return measurements;
  }

  private layoutItems(): void {
    const measurements = this.measureItems();
    let currentX = 0;
    let currentY = 0;
    let currentLineHeight = 0;

    this.items.forEach((el, index) => {
      const { width, height } = measurements[index];
      const requiredSpace = width + 
        (index > 0 ? this.config.horizontalGap : 0);

      // 换行判断
      if (currentX + requiredSpace > this.container.clientWidth) {
        currentY += currentLineHeight + this.config.verticalGap;
        currentX = 0;
        currentLineHeight = 0;
      }
      
      // debug
      console.log('Item:', el.textContent, 'X:', currentX, 'Y:', currentY);

      // 应用定位样式
      el.style.display = 'inline-block';
      el.style.position = 'absolute';
      el.style.left = `${currentX}px`;
      el.style.top = `${currentY}px`;
      el.style.padding = `${this.config.itemPadding}px`;
      el.style.boxSizing = 'content-box';

      // 更新布局状态
      currentX += width + (index > 0 ? this.config.horizontalGap : 0);
      currentLineHeight = Math.max(currentLineHeight, height);
    });

    // 更新容器高度
    this.container.style.height = `${currentY + currentLineHeight}px`;
  }

  // 重新布局接口
  public refresh(): void {
    this.collectItems();
    this.adjustItemStyles();
    this.layoutItems();
  }
}

export { AutoCloudLayout };

// 响应窗口变化
// #TODO
//window.addEventListener('resize', () => cloudLayout.refresh());