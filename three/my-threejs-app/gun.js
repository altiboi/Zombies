import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { gsap } from 'gsap/gsap-core';

let paintballs = [];
let paintballsToRemove = [];
let zombies = [];
let bodyMeshMap = new Map();
export let gun = null;
let gunshotSound = null;
let reloadSound = null;
let emptyMagazineSound = null;
let gunLoaded = false;
let currentAmmo;
let magazineSize;
let isReloading = false;

export function initGun(zombiesArray, bodyMeshMapInstance, renderer, camera) {
    zombies = zombiesArray;
    bodyMeshMap = bodyMeshMapInstance;

    // Retrieve the current level from local storage
    const currentLevel = parseInt(localStorage.getItem('currentLevel')) || 1;

    // Adjust the magazine size based on the current level
    magazineSize = Math.max(30 - (currentLevel - 1) * 10, 10); // Decrease by 2 per level, minimum of 10
    currentAmmo = magazineSize;

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
    const audioLoader = new THREE.AudioLoader();

    gunshotSound = new THREE.Audio(listener);
    audioLoader.load('./assets/audio/gunshot.mp3', (buffer) => {
        gunshotSound.setBuffer(buffer);
        gunshotSound.setVolume(0.4); // Adjust volume as needed
    });

    reloadSound = new THREE.Audio(listener);
    audioLoader.load('./assets/audio/reload.mp3', (buffer) => {
        reloadSound.setBuffer(buffer);
        reloadSound.setVolume(0.4); // Adjust volume as needed
    });

    emptyMagazineSound = new THREE.Audio(listener);
    audioLoader.load('./assets/audio/emptymag.mp3', (buffer) => {
        emptyMagazineSound.setBuffer(buffer);
        emptyMagazineSound.setVolume(0.5); // Adjust volume as needed
    });

    return gunLoadPromise; // Return the promise
}

// Shooting logic with a max of 50 paintballs
export function shootPaintball(world, scene, camera, handleZombieDeath) {
    if(currentAmmo <= 0) {
        if (emptyMagazineSound.isPlaying) {
            emptyMagazineSound.stop();
        }
        emptyMagazineSound.play();
        return;
    }

    if (!gunLoaded || isReloading) {
        console.error('Cannot shoot: Gun not loaded, gun not ready or reloading');
        return;
    }

    // Play the gunshot sound
    if (gunshotSound.isPlaying) {
        gunshotSound.stop();
    }
    gunshotSound.play();

    currentAmmo--; // Decrease ammo count
    updateAmmoDisplay();
    
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
        direction.x * 350,
        direction.y * 350,
        direction.z * 350
    );

    paintballBody.velocityThreshold = 1e6; // Adjust the velocity threshold as needed
    paintballBody.collisionResponse = true;
    paintballBody.linearDamping = 0.01; // Adjust the linear damping as needed
    world.addBody(paintballBody);

    const paintballGeometry = new THREE.SphereGeometry(0.02, 32, 32);
    const paintballMaterial = new THREE.MeshStandardMaterial({ color: genRandomColor() });
    const paintballMesh = new THREE.Mesh(paintballGeometry, paintballMaterial);
    paintballMesh.position.copy(paintballBody.position);
    scene.add(paintballMesh);

    // Create bullet trail
    // const trail = createBulletTrail(paintballMesh);
    // scene.add(trail);
    // console.log(trail)

    paintballs.push({ body: paintballBody, mesh: paintballMesh});

    createSpark(paintballBody.position, scene);
    applyRecoil(0.25);
}



export function updatePaintballs(world, scene, handleZombieDeath) {
    paintballs.forEach(paintball => {
        paintball.mesh.position.copy(paintball.body.position);
        paintball.mesh.quaternion.copy(paintball.body.quaternion);

        world.bodies.forEach(body => {
            if (body !== paintball.body && body.shapes.length > 0) {
                const shape = body.shapes[0];
                const distance = paintball.body.position.distanceTo(body.position);
                const collisionDistance = paintball.body.shapes[0].boundingSphereRadius + shape.boundingSphereRadius;

                if (distance < collisionDistance) {
                    const collidedWith = body; // The body the paintball collided with
                    // Check if the collided body is a zombie
                    const zombie = zombies.find(z => z.body === collidedWith);
                    if (zombie && !zombie.isDead) {
                        // Determine if the hit is near the head
                        const headHeight = 2.7; // Approximate height of the zombie's head
                        const headThreshold = 0.5; // Threshold distance to consider a hit near the head
                        const hitPosition = paintball.body.position.y;
        
                        let damage = 1; // Default damage
                        if (Math.abs(hitPosition - (zombie.body.position.y + headHeight)) < headThreshold) {
                            console.log("Headshot");
                            damage = 2; // Double damage if hit is near the head
                        }
        
                        zombie.getShot(damage);
                        if (zombie.life <= 0) {
                            handleZombieDeath(zombie); // Call the callback function when the zombie is killed
                        }
                        // Remove paintball immediately upon collision
                        world.removeBody(paintball.body);
                        scene.remove(paintball.mesh);
                        paintballs = paintballs.filter(p => p.body !== paintball.body);
                        return;
                    }
                }
            }
        });
    });
}

export function reloadGun() {
    if (isReloading || currentAmmo === magazineSize) {
        return;
    }

    isReloading = true;
    if (reloadSound.isPlaying) {
        reloadSound.stop();
    }
    reloadSound.play();
    console.log('Reloading...');
    applyRecoil(2);
    // Simulate reload time
    setTimeout(() => {
        currentAmmo = magazineSize;
        isReloading = false;
        console.log('Reloaded');
        updateAmmoDisplay();
    }, 2000); // Adjust reload time as needed
}

// Function to update the ammo display
function updateAmmoDisplay() {
    const ammoDisplay = document.getElementById('ammoDisplay');
    ammoDisplay.textContent = `Ammo: ${currentAmmo}/${magazineSize}`;

    const reloadButton = document.getElementById('reloadButton');
    if (currentAmmo < 10) {
        reloadButton.style.display = 'block';
    } else {
        reloadButton.style.display = 'none';
    }
}

// Initial setup for ammo display and reload button
document.addEventListener('DOMContentLoaded', () => {
    const ammoDisplay = document.createElement('div');
    ammoDisplay.id = 'ammoDisplay';
    ammoDisplay.style.position = 'absolute';
    ammoDisplay.style.bottom = '10px';
    ammoDisplay.style.right = '10px';
    ammoDisplay.style.color = 'white';
    ammoDisplay.style.fontSize = '20px';
    ammoDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    ammoDisplay.style.padding = '5px';
    ammoDisplay.style.borderRadius = '5px';
    document.body.appendChild(ammoDisplay);

    const reloadButton = document.createElement('button');
    reloadButton.id = 'reloadButton';
    reloadButton.textContent = 'Reload';
    reloadButton.style.position = 'absolute';
    reloadButton.style.bottom = '50px';
    reloadButton.style.right = '10px';
    reloadButton.style.display = 'none';
    reloadButton.addEventListener('click', reloadGun);
    document.body.appendChild(reloadButton);

    updateAmmoDisplay();
});

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
function createSplat(intersectedObject, position, normal, color, scene) {
    const size = new THREE.Vector3(0.85, 0.85, 0.85);
    const index = Math.floor(Math.random() * splatTextures.length);
    const texture = splatTextures[index];
    const splatMaterial = new THREE.MeshBasicMaterial({
        
        alphaMap: texture,
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
    const offset = normal.clone().multiplyScalar(0.5);
    const splatPosition = position.clone().add(offset);

    const splatGeometry = new DecalGeometry(intersectedObject, splatPosition, normal, size);
    const splat = new THREE.Mesh(splatGeometry, splatMaterial);
    splat.renderOrder = 1;

    // Add splat to the scene
    scene.add(splat);
    console.log('Splat created:');
}

// Function to apply recoil effect
function applyRecoil(duration) {
    const recoilDistance = 0.05; // Adjust the recoil distance as needed
    const recoilRotation = 0.1; // Adjust the recoil rotation as needed

    // Apply recoil
    gun.position.z += recoilDistance;
    gun.rotation.x += recoilRotation;

    // Gradually return the gun to its original position and rotation
    // Gradually return the gun to its original position and rotation using GSAP
    gsap.to(gun.position, { z: gun.position.z - recoilDistance, duration: duration });
    gsap.to(gun.rotation, { x: gun.rotation.x - recoilRotation, duration: duration });
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
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.8 });
    const trailGeometry = new THREE.BufferGeometry();
    
    // Initialize the trail with a start and end point (two points)
    const positions = new Float32Array(6); // 2 points * 3 coordinates (x, y, z)
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    trail.frustumCulled = false; // Make sure the trail is always rendered

    paintballMesh.trail = trail;
    paintballMesh.previousPosition = paintballMesh.position.clone(); // Store the initial position

    return trail;
}