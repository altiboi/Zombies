import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadow rendering
document.body.appendChild(renderer.domElement);

camera.position.set(0, 2, 10);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1).normalize();
directionalLight.castShadow = true;
scene.add(directionalLight);

const planeGeometry = new THREE.PlaneGeometry(100, 100);
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x999999, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

const loader = new FBXLoader();
const zombies = []; // Array to hold all zombies
const clock = new THREE.Clock(); // Create a clock to manage time deltas

const createZombie = (skin, position) => {
    loader.load(skin, (fbx) => {
        fbx.scale.set(0.01, 0.01, 0.01);
        fbx.position.copy(position);
        fbx.name = 'Zombie';
        scene.add(fbx);

        const mixer = new THREE.AnimationMixer(fbx);
        const zombieData = { fbx, mixer, actionChosen: false, chosenAction: null };

        // Load animations
        loader.load('/Running.fbx', (fb) => {
            zombieData.runAction = mixer.clipAction(fb.animations[0]);
            zombieData.runAction.play();
        });
        loader.load('/Zombie_Punching.fbx', (fb) => {
            zombieData.punchAction = mixer.clipAction(fb.animations[0]);
        });
        loader.load('/zombie_biting.fbx', (fb) => {
            zombieData.biteAction = mixer.clipAction(fb.animations[0]);
        });
        loader.load('/zombie_biting_neck.fbx', (fb) => {
            zombieData.biteNeckAction = mixer.clipAction(fb.animations[0]);
        });

        zombies.push(zombieData);

        fbx.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    });
};

createZombie('/Warzombie.fbx', new THREE.Vector3(5, 0, 5));
createZombie('/YakuZombie.fbx', new THREE.Vector3(-5, 0, 5));
createZombie('/Zombiegirl.fbx', new THREE.Vector3(5, 0, -5));

function getRandomAction(zombie) {
    const actions = [
        zombie.punchAction,
        zombie.biteAction,
        zombie.biteNeckAction
    ].filter(action => action); // Filter out undefined actions
    const randomIndex = Math.floor(Math.random() * actions.length);
    return actions[randomIndex];
}

// Keyboard movement controls
const keyboard = {};
window.addEventListener('keydown', (event) => {
    keyboard[event.key] = true;
});
window.addEventListener('keyup', (event) => {
    keyboard[event.key] = false;
});

let zombieSpeed = 0.05; // Speed at which the zombie runs
let minimumDistance = 1.5; // Distance at which the zombie stops running and can punch

function switchAction(zombie, toAction) {
    if (zombie.activeAction !== toAction) {
        if (zombie.activeAction) zombie.activeAction.fadeOut(0.5); // Smooth transition between animations
        toAction.reset().fadeIn(0.5).play(); // Play the new animation
        zombie.activeAction = toAction; // Update the active action
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    zombies.forEach(zombie => {
        const { fbx, mixer } = zombie;
        if (mixer) mixer.update(delta);

        const zombiePosition = new THREE.Vector3();
        const cameraPosition = new THREE.Vector3();
        fbx.getWorldPosition(zombiePosition);
        camera.getWorldPosition(cameraPosition);

        const direction = new THREE.Vector3().subVectors(cameraPosition, zombiePosition).normalize();
        fbx.lookAt(cameraPosition);

        const distanceToCamera = zombiePosition.distanceTo(cameraPosition);

        if (distanceToCamera > minimumDistance) {
            // Reset the action choice if the zombie is far away
            zombie.actionChosen = false; // Reset the action choice
            fbx.position.add(direction.multiplyScalar(zombieSpeed)); // Move the zombie towards the camera

            // Play the running animation
            if (zombie.runAction) {
                switchAction(zombie, zombie.runAction);
            }
        } else {
            // Choose and stick to a random action if not chosen yet
            if (!zombie.actionChosen) {
                zombie.chosenAction = getRandomAction(zombie); // Randomly choose an action
                zombie.actionChosen = true; // Mark the action as chosen
            }
            // Execute the chosen action
            if (zombie.chosenAction) {
                switchAction(zombie, zombie.chosenAction); // Stick to the chosen action
            }
        }
    });

    renderer.render(scene, camera);

    const moveSpeed = 0.1;
    if (keyboard['w']) camera.position.z -= moveSpeed;
    if (keyboard['s']) camera.position.z += moveSpeed;
    if (keyboard['a']) camera.position.x -= moveSpeed;
    if (keyboard['d']) camera.position.x += moveSpeed;
    if (keyboard['q']) camera.position.y += moveSpeed;
    if (keyboard['e']) camera.position.y -= moveSpeed;
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
