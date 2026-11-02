/**
 * A phone in real 3D for an app's lead shot: a rounded metal band around glass, lit by a room, with
 * the screenshot on its screen. Loaded on demand by phone3d.ts, which owns when it shows and how it
 * leans; this module only builds the scene and draws it.
 */
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  CapsuleGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Real proportions, in millimetres (a 6.1" phone).
const W = 71.6;
const H = 147.6;
const D = 7.8;
const R = 10.8;
// How far the rounded edge eats into the depth and into the outline.
const BEVEL = 2.6;
const ROUND = 1.9;
// The screen texture: a 390 x 844 pt screen at 3x, the top 47 pt being the drawn status bar.
const TW = 1170;
const TH = 2532;
const BAR = 141;

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** The status bar is drawn, not captured: the app runs in a browser, which has none. */
function drawScreen(img: HTMLImageElement, darkSite: boolean) {
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  const g = c.getContext('2d')!;
  // Its colors follow the edition on screen, the opposite of the site's theme.
  const fg = darkSite ? '#111318' : '#f4f5f7';
  const mid = BAR * 0.55;
  g.fillStyle = darkSite ? '#f3f4f6' : '#15171c';
  g.fillRect(0, 0, TW, BAR);
  g.drawImage(img, 0, BAR, TW, TH - BAR);
  g.fillStyle = fg;
  g.font = `600 50px ${getComputedStyle(document.body).fontFamily}`;
  g.textBaseline = 'middle';
  g.fillText('9:41', 128, mid);
  g.fillStyle = '#000';
  g.beginPath();
  g.roundRect(TW / 2 - 182, 30, 364, 104, 52);
  g.fill();
  g.fillStyle = fg;
  [24, 32, 42, 52].forEach((h, i) => {
    g.beginPath();
    g.roundRect(860 + i * 16, mid + 26 - h, 11, h, 3);
    g.fill();
  });
  g.strokeStyle = fg;
  g.lineWidth = 6;
  for (const r of [10, 22, 34]) {
    g.beginPath();
    g.arc(950, mid + 22, r, -Math.PI * 0.75, -Math.PI * 0.25);
    g.stroke();
  }
  g.globalAlpha = 0.45;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(1000, mid - 18, 70, 36, 10);
  g.stroke();
  g.globalAlpha = 1;
  g.beginPath();
  g.roundRect(1007, mid - 11, 48, 22, 5);
  g.fill();
  return c;
}

export interface PhoneModel {
  /** The phone's height as a share of the canvas height. */
  fill: number;
  setScreen(img: HTMLImageElement, darkSite: boolean): void;
  resize(width: number, height: number): void;
  render(rx: number, ry: number): void;
}

export function createPhone(canvas: HTMLCanvasElement, fill: number): PhoneModel {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(-60, 120, 140);
  scene.add(key);

  // A long lens, as in product photography: little distortion, so the phone reads as an object.
  const camera = new PerspectiveCamera(18, 1, 10, 4000);
  const phone = new Group();
  scene.add(phone);

  const metal = new MeshPhysicalMaterial({ color: 0xa9a6a0, metalness: 1, roughness: 0.32, envMapIntensity: 1.1 });
  const glass = new MeshPhysicalMaterial({ color: 0x060607, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 });

  // The body: the outline extruded with a rounded edge. Its caps are glass, its sides the metal band.
  const body = new ExtrudeGeometry(roundedRect(W - ROUND * 2, H - ROUND * 2, R - ROUND), {
    depth: D - BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: ROUND,
    bevelSegments: 12,
    curveSegments: 40,
  });
  body.translate(0, 0, -(D - BEVEL * 2) / 2);
  phone.add(new Mesh(body, [glass, metal]));

  // Side buttons: power on the right; action and volume on the left.
  const button = (length: number, x: number, y: number) => {
    const m = new Mesh(new CapsuleGeometry(0.75, length, 6, 16), metal);
    m.position.set(x, y, 0);
    m.scale.z = 1.6;
    phone.add(m);
  };
  button(15, W / 2 + 0.1, H * 0.18);
  button(5, -W / 2 - 0.1, H * 0.33);
  button(10, -W / 2 - 0.1, H * 0.21);
  button(10, -W / 2 - 0.1, H * 0.06);

  // The screen glows with its own colors (emissive, untouched by the light) under glass that
  // reflects the room as the phone turns.
  const SW = W - 6.2;
  const SH = SW / (TW / TH);
  const screenGeo = new ShapeGeometry(roundedRect(SW, SH, R - 2.9), 32);
  const uv = screenGeo.attributes.uv;
  const pos = screenGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + SW / 2) / SW, (pos.getY(i) + SH / 2) / SH);
  const screenMat = new MeshPhysicalMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 0.55,
  });
  const screen = new Mesh(screenGeo, screenMat);
  screen.position.z = D / 2 + 0.01;
  phone.add(screen);

  return {
    fill,
    setScreen(img, darkSite) {
      const texture = new CanvasTexture(drawScreen(img, darkSite));
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      screenMat.emissiveMap?.dispose();
      screenMat.emissiveMap = texture;
      screenMat.needsUpdate = true;
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(0, 0, H / fill / 2 / Math.tan(MathUtils.degToRad(camera.fov / 2)));
      camera.updateProjectionMatrix();
    },
    render(rx, ry) {
      phone.rotation.set(rx, ry, 0);
      renderer.render(scene, camera);
    },
  };
}
