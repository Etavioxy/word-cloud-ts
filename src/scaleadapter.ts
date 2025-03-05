class ScaleAdapter {
  private container: HTMLElement;
  private wrapper: HTMLElement;
  private content: HTMLElement;
  private observer: ResizeObserver | null;

  constructor(container: HTMLElement) {
    console.log(container);
    this.container = container;
    this.wrapper = container.querySelector('.scale-wrapper') as HTMLElement;
    this.content = this.wrapper.children[0] as HTMLElement;
    this.observer = null;
    this.init();
  }

  private init(): void {
    // 初始化时强制计算布局
    this.calculateScale();

    // 响应式监听
    this.setupResizeObserver();
  }

  private calculateScale(): void {
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;
    const contentWidth = this.content.offsetWidth;
    const contentHeight = this.content.offsetHeight;
    
    // 计算缩放比例
    const widthRatio = containerWidth / contentWidth;
    const heightRatio = containerHeight / contentHeight;
    const scale = Math.min(widthRatio, heightRatio);

    // 计算实际显示尺寸
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;

    // 应用变换
    this.wrapper.style.transform = `scale(${scale})`;
    
    // 居中定位
    this.wrapper.style.left = `${(containerWidth - scaledWidth) / 2}px`;
    this.wrapper.style.top = `${(containerHeight - scaledHeight) / 2}px`;
  }
  
  private setupResizeObserver(): void {
    if (window.ResizeObserver) {
      this.observer = new ResizeObserver(entries => {
        entries.forEach(entry => this.calculateScale());
      });
      this.observer.observe(this.container);
    } else {
      window.addEventListener('resize', () => {
        this.calculateScale();
      });
    }
  }
}

export { ScaleAdapter };