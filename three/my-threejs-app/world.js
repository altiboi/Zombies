import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {PointerLockControls} from 'three/examples/jsm/controls/PointerLockControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import * as CANNON from 'cannon-es';

export const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.8, 0),
    broadphase: new CANNON.NaiveBroadphase(),
    solver: new CANNON.GSSolver(),
    defaultContactMaterial: new CANNON.Material('default')
});

export const bodyMeshMap = new Map();