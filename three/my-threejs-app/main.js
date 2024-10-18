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
        const zombieData = { fbx, mixer, actionChosen: false, chosenAction: null, isDead: false, life: 10 }; // Set life to 5

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
        loader.load('/Zombie_Dying.fbx', (fb) => {
            zombieData.Dying1 = mixer.clipAction(fb.animations[0]);
            zombieData.Dying1.loop = THREE.LoopOnce; // Set loop mode to LoopOnce
            zombieData.Dying1.clampWhenFinished = true; // Ensure the animation doesn't reset
            console.log('Dying animation loaded:', zombieData.Dying1);
        });
        loader.load('/Zombie_Death.fbx', (fb) => {
            zombieData.Dying2 = mixer.clipAction(fb.animations[0]);
            zombieData.Dying2.loop = THREE.LoopOnce; // Set loop mode to LoopOnce
            zombieData.Dying2.clampWhenFinished = true; // Ensure the animation doesn't reset
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

function getRandomAction(zombie, actions) {
    actions = actions.filter(action => action); // Filter out undefined actions
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
// Global variable to track if Shift is pressed
let isShiftPressed = false;

window.addEventListener('keydown', (event) => {
    keyboard[event.key] = true;

    // Check if Shift key is pressed
    if (event.key === 'Shift') {
        isShiftPressed = true;
    }
});

window.addEventListener('keyup', (event) => {
    keyboard[event.key] = false;

    // Reset Shift key state
    if (event.key === 'Shift') {
        isShiftPressed = false;
    }
});

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


        if (!zombie.isDead && isShiftPressed) {
            zombie.life--;
            console.log(`Zombie life: ${zombie.life}`);

            if (zombie.life <= 0) {
                console.log('Zombie is dying');
                zombie.isDead = true;

                const actions = [zombie.Dying1, zombie.Dying2]; 
                zombie.chosenAction = getRandomAction(zombie, actions);
                switchAction(zombie, zombie.chosenAction);
                return; 
            }
        }

        if (zombie.isDead) {

            if (zombie.chosenAction && !zombie.chosenAction.isRunning()) {
                scene.remove(zombie.fbx);
                zombies.splice(zombies.indexOf(zombie), 1); 
            }
            return; 
        }

     
        if (distanceToCamera > minimumDistance) {
            zombie.actionChosen = false; 
            fbx.position.add(direction.multiplyScalar(zombieSpeed)); 

     
            if (zombie.runAction) {
                switchAction(zombie, zombie.runAction);
            }
        } else {

            const actions = [
                zombie.punchAction,
                zombie.biteAction,
                zombie.biteNeckAction
            ];
            if (!zombie.actionChosen) {
                zombie.chosenAction = getRandomAction(zombie, actions);
                zombie.actionChosen = true;
            }

            if (zombie.chosenAction) {
                switchAction(zombie, zombie.chosenAction);
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
