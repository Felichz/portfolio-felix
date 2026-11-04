/**
 * The 3D phone's thread. Building it costs 500 to 750 ms of linking shaders, at the moment the visitor
 * arrives at the showcase; here that runs beside the page, and three.js never reaches it.
 */
import { createPhone, type PhoneModel } from './phone-model';

export type PhoneMessage =
  | { type: 'init'; canvas: OffscreenCanvas; fill: number; pixelRatio: number }
  | { type: 'size'; width: number; height: number }
  | { type: 'screen'; screen: ImageBitmap }
  | { type: 'turn'; x: number; y: number };

let model: PhoneModel;
let sized = false;
let screened = false;
let shown = false;
const turn = { x: 0, y: 0 };

const draw = () => {
  if (!sized || !screened) return;
  model.render(turn.x, turn.y);
  if (shown) return;
  shown = true;
  // Told a frame later, once this one is on its way to the screen.
  requestAnimationFrame(() => postMessage('drawn'));
};

onmessage = ({ data }: MessageEvent<PhoneMessage>) => {
  if (data.type === 'init') {
    model = createPhone(data.canvas, data.fill, data.pixelRatio);
    return;
  }
  if (data.type === 'size') {
    sized = data.width > 0 && data.height > 0;
    if (sized) model.resize(data.width, data.height);
  } else if (data.type === 'screen') {
    model.setScreen(data.screen);
    screened = true;
  } else {
    turn.x = data.x;
    turn.y = data.y;
  }
  draw();
};
