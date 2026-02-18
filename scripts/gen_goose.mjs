import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    constructor() {
      this.result = null;
      this.onloadend = null;
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (typeof this.onloadend === 'function') {
          this.onloadend();
        }
      });
    }
  };
}

const scene = new THREE.Scene();
const bodyMat = new THREE.MeshStandardMaterial({ color: '#f8f4ea' });
const beakMat = new THREE.MeshStandardMaterial({ color: '#f59e0b' });
const legMat = new THREE.MeshStandardMaterial({ color: '#d97706' });

const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 24), bodyMat);
body.position.set(0, 0.4, 0);

const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.6, 16), bodyMat);
neck.position.set(0, 1.0, 0.25);
neck.rotation.x = -0.2;

const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 20), bodyMat);
head.position.set(0, 1.35, 0.5);

const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 16), beakMat);
beak.position.set(0, 1.28, 0.82);
beak.rotation.x = Math.PI / 2;

const wingL = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), bodyMat);
wingL.position.set(-0.45, 0.55, 0);
wingL.scale.set(1.3, 0.8, 0.3);

const wingR = wingL.clone();
wingR.position.x = 0.45;

const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 12), legMat);
legL.position.set(-0.2, 0.05, 0.1);

const legR = legL.clone();
legR.position.x = 0.2;

const footL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.22), legMat);
footL.position.set(-0.2, -0.15, 0.2);

const footR = footL.clone();
footR.position.x = 0.2;

scene.add(body, neck, head, beak, wingL, wingR, legL, legR, footL, footR);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (result) => {
    const out = '/Users/JerryXu/Desktop/zhuadae/goose-catch-main/src/assets/goose.glb';
    const buffer = Buffer.from(result);
    fs.writeFileSync(out, buffer);
    console.log('wrote', out, buffer.length);
  },
  (err) => {
    console.error('GLB export error', err);
  },
  { binary: true }
);
