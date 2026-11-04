/**
 * A phone in real 3D for an app's lead shot: a rounded metal band around glass, lit by a studio, with
 * the screenshot on its screen. Runs in phone-worker.ts; phone3d.ts owns when it shows and how it
 * leans, and this module only builds the scene and draws it.
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  DoubleSide,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { TH, TW } from './phone-screen';

// Real proportions, in millimetres (a 6.1" phone).
const W = 71.6;
const H = 147.6;
const D = 7.8;
const R = 10.8;
// How far the rounded edge eats into the depth and into the outline.
const BEVEL = 2.6;
const ROUND = 1.9;

/**
 * The light the phone reflects, as in a product photo: a dim room with softboxes to the sides and
 * above, which the rounded metal edge catches, and only a faint panel behind the camera, which is
 * what the screen's glass faces. A tilt of up to 16 degrees swings the screen's reflection about 32
 * degrees, so the bright boxes stay well outside that cone and never wash the screen out.
 */
function studio() {
  const room = new Scene();
  const walls = new Mesh(new BoxGeometry(20, 20, 20), new MeshBasicMaterial({ color: 0x2c2c31, side: BackSide }));
  room.add(walls);
  const panel = (w: number, h: number, light: number, x: number, y: number, z: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }));
    m.material.color.multiplyScalar(light);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  panel(5, 12, 5, -7, 1, 4);
  panel(4, 12, 3, 7, 0, 3.5);
  panel(10, 3, 4, 0, 7, 2);
  // Behind the camera, over its left half only: a soft edge for the glass to sweep across.
  panel(6, 8, 0.45, -3.5, 1, 8);
  return room;
}

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

export interface PhoneModel {
  /** The phone's height as a share of the canvas height. */
  fill: number;
  setScreen(screen: ImageBitmap): void;
  resize(width: number, height: number): void;
  render(rx: number, ry: number): void;
}

export function createPhone(canvas: OffscreenCanvas, fill: number, pixelRatio: number): PhoneModel {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  pmrem.dispose();

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

  // The screen shows its own colors, untouched by the light. Over it, the glass adds only what it
  // reflects (additive, black underneath), blurred and faint: a sharp reflection of the room's lights
  // would wash the whole screen out at some angles.
  const SW = W - 6.2;
  const SH = SW / (TW / TH);
  const screenGeo = new ShapeGeometry(roundedRect(SW, SH, R - 2.9), 32);
  const uv = screenGeo.attributes.uv;
  const pos = screenGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + SW / 2) / SW, (pos.getY(i) + SH / 2) / SH);
  const screenMat = new MeshBasicMaterial({ toneMapped: false });
  const screen = new Mesh(screenGeo, screenMat);
  screen.position.z = D / 2 + 0.01;
  phone.add(screen);
  const reflection = new Mesh(
    screenGeo,
    new MeshPhysicalMaterial({
      color: 0x000000,
      roughness: 0.18,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  reflection.position.z = D / 2 + 0.03;
  phone.add(reflection);

  return {
    fill,
    setScreen(screen) {
      // Through a canvas: a texture made from a bitmap ignores flipY and would stand upside down.
      const copy = new OffscreenCanvas(screen.width, screen.height);
      copy.getContext('2d')!.drawImage(screen, 0, 0);
      screen.close();
      const texture = new CanvasTexture(copy);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      screenMat.map?.dispose();
      screenMat.map = texture;
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
