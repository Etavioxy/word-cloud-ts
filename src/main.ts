import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)

import { AutoCloudLayout } from './cloud/index.ts';
import './cloud/style.css';

// 使用示例
const [cloudContainer, secondCloudContainer] = Array.from(document.querySelectorAll('.cloud')) as [HTMLDivElement, HTMLDivElement];

const config = {
  baseFontSize: 14,
  fontSizeScale: 4,
  imageSize: 28,
  horizontalGap: 15,
  verticalGap: 20,
  fontFamily: 'Segoe UI',
  itemPadding: 6,
  seed: 12345
};

const cloudLayout = new AutoCloudLayout(cloudContainer, config);

const cloudLayout2 = new AutoCloudLayout(secondCloudContainer, config);