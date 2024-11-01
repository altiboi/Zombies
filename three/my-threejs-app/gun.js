import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap/gsap-core';

let paintballs = [];
let paintballsToRemove = [];
let zombies = [];
let bodyMeshMap = new Map();
export let gun = null;
let gunshotSound = null;
let gunLoaded = false;

export function initGun(zombiesArray, bodyMeshMapInstance, renderer, camera) {
    zombies = zombiesArray;
    bodyMeshMap = bodyMeshMapInstance;

    // Load the gun model
    const GLTFloader = new GLTFLoader();
    const gunLoadPromise = new Promise((resolve, reject) => {
        GLTFloader.load('./submachine_gun.glb', function (gltf) {
            gun = gltf.scene;
            renderer.shadowMap.enabled = true;
            gun.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            gun.scale.set(0.01, 0.01, 0.01);  // Scale the gun to fit the player's hand
            gun.position.set(0.2, -0.1, -0.075); // Position relative to the player's view (adjust as needed)
            gun.rotation.set(0, Math.PI / 2, 0);
            gun.renderOrder = 2;
            camera.add(gun);  // Add the gun to the player's camera so it follows the view
            console.log("Gun loaded successfully:", gun);
            gunLoaded = true; // Set the flag to true when the gun is loaded
            resolve();
        }, undefined, function (error) {
            console.error("Error loading gun:", error);
            reject(error);
        });
    });

    // Load the gunshot sound
    const listener = new THREE.AudioListener();
    camera.add(listener);

    gunshotSound = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('./assets/audio/gunshot.wav', (buffer) => {
        gunshotSound.setBuffer(buffer);
        gunshotSound.setVolume(0.5); // Adjust volume as needed
    });

    return gunLoadPromise; // Return the promise
}

// Shooting logic with a max of 50 paintballs
export function shootPaintball(world, scene, camera) {
    if (!gunLoaded) {
        console.error('Gun model not loaded yet.');
        return;
    }

    // Play the gunshot sound
    if (gunshotSound.isPlaying) {
        gunshotSound.stop();
    }
    gunshotSound.play();
    
    if (paintballs.length >= 50) {
        const oldestPaintball = paintballs.shift();
        world.removeBody(oldestPaintball.body);
        scene.remove(oldestPaintball.mesh);
        scene.remove(oldestPaintball.trail);
    }

    const paintballShape = new CANNON.Sphere(0.02);
    const paintballBody = new CANNON.Body({ mass: 0.01 });
    paintballBody.addShape(paintballShape);

    // Get the gun barrel position
    const gunBarrelPosition = new THREE.Vector3();
    gun.getWorldPosition(gunBarrelPosition);

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();

    // Offset the paintball's initial position slightly forward along the shooting direction
    const offset = direction.clone().multiplyScalar(0.75); // Adjust the scalar value as needed

    paintballBody.position.set(
        gunBarrelPosition.x + offset.x,
        gunBarrelPosition.y + offset.y,
        gunBarrelPosition.z + offset.z
    );

    paintballBody.velocity.set(
        direction.x * 100,
        direction.y * 100,
        direction.z * 100
    );

    world.addBody(paintballBody);

    const paintballGeometry = new THREE.SphereGeometry(0.02, 32, 32);
    const paintballMaterial = new THREE.MeshStandardMaterial({ color: genRandomColor() });
    const paintballMesh = new THREE.Mesh(paintballGeometry, paintballMaterial);
    paintballMesh.position.copy(paintballBody.position);
    scene.add(paintballMesh);

    // Create bullet trail
    //const trail = createBulletTrail(paintballMesh);

    paintballs.push({ body: paintballBody, mesh: paintballMesh});

    createSpark(paintballBody.position, scene);
    applyRecoil();

   // Add collision event listener
   paintballBody.addEventListener('collide', (event) => {
        const collidedWith = event.body; // The body the paintball collided with
        console.log('Paintball collided with:', collidedWith);
        // Check if the collided body is a zombie
        const zombie = zombies.find(z => z.body === collidedWith);
        if (zombie) {
            zombie.getShot(1);
        }

        // Get the corresponding THREE.Mesh object
        const intersectedObject = bodyMeshMap.get(collidedWith);

        if (intersectedObject) {
            // Add a mark at the collision point
            //console.log('Paintball collided with:', collidedWith);
            const contact = event.contact;
            const collisionPoint = new THREE.Vector3().copy(contact.rj).applyQuaternion(collidedWith.quaternion);
            const collisionNormal = new THREE.Vector3().copy(contact.ni);
            createSplat(intersectedObject, collisionPoint, collisionNormal, paintballMesh.material.color);
        }

        // Mark paintball for removal on collision
        paintballsToRemove.push({ body: paintballBody, mesh: paintballMesh });
    });
}

export function updatePaintballs(world, scene) {
    paintballs.forEach(paintball => {
        paintball.mesh.position.copy(paintball.body.position);
        paintball.mesh.quaternion.copy(paintball.body.quaternion);

        // // Update trail
        // const positions = paintball.trail.geometry.attributes.position.array;
        // positions[0] = paintball.body.previousPosition.x;
        // positions[1] = paintball.body.previousPosition.y;
        // positions[2] = paintball.body.previousPosition.z;
        // positions[3] = paintball.body.position.x;
        // positions[4] = paintball.body.position.y;
        // positions[5] = paintball.body.position.z;
        // paintball.trail.geometry.attributes.position.needsUpdate = true;
    });
    
    paintballsToRemove.forEach(({ body, mesh }) => {
        world.removeBody(body);
        scene.remove(mesh);
    });
    paintballsToRemove = [];
}

function genRandomColor() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${r},${g},${b})`;
}

const splatTextures = [
    new THREE.TextureLoader().load('./assets/images/splatter-test1.png'),
    new THREE.TextureLoader().load('./assets/images/splatter-test2.png'),
    new THREE.TextureLoader().load('./assets/images/splatter-test1.png'),
    new THREE.TextureLoader().load('./assets/images/splatter-test2.png'),
];

splatTextures.forEach((texture) => {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 16;
});

// Function to create a splat on collision
function createSplat(intersectedObject, position, normal, color) {
    const size = new THREE.Vector3(0.85, 0.85, 0.85);
    const index = Math.floor(Math.random() * splatTextures.length);
    const texture = splatTextures[index];
    const splatMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        color: color,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        side: THREE.DoubleSide,
    });

    normal.normalize();

    // Offset the position slightly along the normal
    const offset = normal.clone().multiplyScalar(0.01);
    const splatPosition = position.clone().add(offset);

    const splatGeometry = new DecalGeometry(intersectedObject, splatPosition, normal, size);
    const splat = new THREE.Mesh(splatGeometry, splatMaterial);
    splat.renderOrder = 1;

    // Add splat to the scene
    scene.add(splat);
}

// Function to apply recoil effect
function applyRecoil() {
    const recoilDistance = 0.05; // Adjust the recoil distance as needed
    const recoilRotation = 0.1; // Adjust the recoil rotation as needed

    // Apply recoil
    gun.position.z += recoilDistance;
    gun.rotation.x += recoilRotation;

    // Gradually return the gun to its original position and rotation
    // Gradually return the gun to its original position and rotation using GSAP
    gsap.to(gun.position, { z: gun.position.z - recoilDistance, duration: 0.25 });
    gsap.to(gun.rotation, { x: gun.rotation.x - recoilRotation, duration: 0.25 });
}

// Function to create a spark effect
function createSpark(position, scene) {
    const sparkGeometry = new THREE.BufferGeometry();
    const sparkMaterial = new THREE.PointsMaterial({ color: 0xffa500, size: 0.1 });

    const sparkCount = 10;
    const positions = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
        positions[i * 3] = position.x + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.2;
    }

    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
    scene.add(sparks);

    // Remove sparks after a short duration
    setTimeout(() => {
        scene.remove(sparks);
    }, 100);
}

// Function to create a bullet trail
function createBulletTrail(paintballMesh) {
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffa500 });
    const trailGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // Two points (start and end) with 3 coordinates each

    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trail = new THREE.Line(trailGeometry, trailMaterial);

    scene.add(trail);

    return trail;
}