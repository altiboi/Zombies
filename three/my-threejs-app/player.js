import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// Initialize player controls
export function initPlayerControls(camera, scene) {
    const controls = new PointerLockControls(camera, document.body);

    document.addEventListener('click', function () {
        controls.lock();
    });

    controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
    });

    controls.addEventListener('unlock', function () {
        instructions.style.display = 'block';
    });

    // Set initial position of the player
    controls.object.position.set(80, 5, 80); // Adjust y-value to make the player taller
    scene.add(controls.object);

    return controls;
}

// Initialize player physics body
export function initPlayerPhysics(world) {
    const characterShape = new CANNON.Sphere(0.5); // Example shape
    const characterBody = new CANNON.Body({ mass: 100 });
    characterBody.position.set(80, 5, 80);
    characterBody.addShape(characterShape);
    world.addBody(characterBody);

    return characterBody;
}

export function handlePlayerActions(){
    
}