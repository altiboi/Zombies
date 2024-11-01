import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {PointerLockControls} from 'three/examples/jsm/controls/PointerLockControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import * as CANNON from 'cannon-es';
import { gsap } from 'gsap/gsap-core';
import Zombie from './zombies'
import { initPlayerControls, initPlayerPhysics } from './player';
import { world, bodyMeshMap } from './world';
import { initGun, shootPaintball, updatePaintballs, gun } from './gun';
//import { createTerrain } from './terrain';



// Loading Manager to track progress
const loadingManager = new THREE.LoadingManager(
    () => {
        // Hide loading screen when loading is complete
        document.getElementById('loading-screen').style.display = 'none';
    },
    (itemUrl, itemsLoaded, itemsTotal) => {
        // Update the progress bar
        const progress = (itemsLoaded / itemsTotal) * 100;
        document.getElementById('progress-bar').style.width = `${progress}%`;
    }
);

let sun, moon, sunMesh, moonMesh,  sky, clouds, stars, terrainGeometry;
let daySkyMaterial, nightSkyMaterial;
let playerLife = 5; // Player starts with 5 life points
let moveSpeed = 20;
let kills = 0;
let currentLevel = 1;
let isGameOver = false;
let gameOverScreen;
let isPaused = false; // Game pause state
const pauseSign = document.getElementById('pauseSign');
const playSign = document.getElementById('playSign');


const powerUps = []; // Array to store active power-ups
const zombiesToRemove = [];


function pauseGame() {
    isPaused = true; // Set the pause state to true
    pauseSign.style.display = 'block'; // Show the pause sign
        playSign.style.display = 'none'; // Hide the play sign
        clock.stop(); // Stop the clock when paused
    console.log('Game Paused');
    // Optionally, display a pause menu or overlay here
}

// Function to resume the game
function resumeGame() {
    isPaused = false; // Set the pause state to false
    console.log('Game Resumed');
    pauseSign.style.display = 'none'; // Hide the pause sign
        playSign.style.display = 'block'; // Show the play sign
        clock.start(); // Resume the clock
        
        // Hide the play sign after 1 second
        setTimeout(() => {
            playSign.style.display = 'none'; // Hide the play sign after 1 second
        }, 1000);
    animate(); // Restart the render loop
}


const powerUpTypes = {
    ZOMBIE_SLOWDOWN: 'zombieSlowdown',
    PLAYER_SPEEDUP: 'playerSpeedup',
    HEALTH_BOOST: 'healthBoost',
};

class PowerUp {
    constructor(type, position,scene) {
        this.type = type;
        this.position = position;
        this.isActive = true;
        this.scene = scene

        
        this.mesh =null;
        this.loadModel(loadPowerUp);
      

       
    }

    loadModel(loader) {
        let scalar,modelPath;

        // Define the path to the 3D model file based on power-up type
        switch (this.type) {
            case powerUpTypes.ZOMBIE_SLOWDOWN:
                modelPath = './shell.glb'; // Path to zombie slowdown model
                scalar = 0.0018;
                break;
                
            case powerUpTypes.PLAYER_SPEEDUP:
                modelPath = './lightning.glb'; // Path to player speedup model
                scalar = 2;
                break;
            case powerUpTypes.HEALTH_BOOST:
                modelPath = './medicines.glb'; // Path to health boost model
                scalar = 0.05;
                break;
            default:
                console.error('Unknown power-up type');
                return;
        }

        // Load the 3D model using GLTFLoader
        loader.load(modelPath, (gltf) => {
            this.mesh = gltf.scene;
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone(); // Clone the original material to preserve it
                }
            });
        
            // Add the original mesh to the scene (with base colors/textures)
            this.mesh.position.copy(this.position);
            this.mesh.scale.setScalar(scalar);
            this.scene.add(this.mesh);
        
            // Create the glow effect on top of the original model
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,    // Yellow glow or change per power-up type
                transparent: true,
                opacity: 0.9,       // Adjust opacity for glowing effect
            });
        
            // Create a duplicate mesh for the glow
            const glowMesh = new THREE.Mesh(this.mesh.geometry.clone(), glowMaterial);
            glowMesh.scale.multiplyScalar(1.05);  // Slightly larger than original mesh for glow effect
        
            this.scene.add(this.mesh);
        }, undefined, (error) => {
            console.error('An error occurred while loading the model:', error);
        });
    }


    // Collect the power-up
    

    // Function to apply power-up effects
    applyPowerUpEffect(type) {
        switch (type) {
            case powerUpTypes.ZOMBIE_SLOWDOWN:
                zombieSpeed *= 0.5; // Slow down zombies
                console.log('Zombies slowed down!');
                break;
            case powerUpTypes.PLAYER_SPEEDUP:
                moveSpeed *= 1.5; // Speed up player
                console.log('Player speed increased!');
                break;
            case powerUpTypes.HEALTH_BOOST:
                playerLife = Math.min(playerLife + 1, 5); // Heal player, max life is 5
                console.log('Player health boosted!');
                updateLifeBar()
                break;
            default:
                break;
        }
    }

    collect() {
        this.isActive = false;
        this.scene.remove(this.mesh); // Remove the mesh from the scene
        this.applyPowerUpEffect(this.type); // Apply the power-up effect
    }

}




// Set up the scene, camera, and renderer

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight , 0.1, 1000);
camera.position.set(0, 5, 0);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
document.body.appendChild(renderer.domElement);
let zombieSpeed = 2; // Speed at which the zombie runs
let minimumDistance = 1.5; // Distance at which the zombie stops running and can punch
const width=800;
const length = 800;
const zombies = [];
const obstacles = [];
const loader = new FBXLoader(loadingManager); 
const loadPowerUp = new GLTFLoader(loadingManager); 

const controls = initPlayerControls(camera, scene);
const characterBody = initPlayerPhysics(world);
initGun(zombies, bodyMeshMap, renderer, camera).then(() => {
    document.addEventListener('mousedown', onShoot);
});

function onShoot(){
    shootPaintball(world, scene, camera);
}

const MalescreamSound = new Audio('./assets/audio/scream.mp3'); // Replace with your audio file path
MalescreamSound.volume = 0.5; // Set volume to 70%

const forestSound = new Audio('./assets/audio/forest.mp3'); // Replace with your audio file path
forestSound.loop = true; // Loop the sound for continuous play
forestSound.volume = 0.4; // Set volume to 70%


// Function to start playing the background sound
function startBackgroundSound() {
    forestSound.play().catch(error => {
        console.error("Error playing forest sound:", error);
    });
}

characterBody.addEventListener('collide', (event) => {
    const contact = event.contact;
    const otherBody = event.body; // The other body involved in the collision
    if(otherBody !== worldTerrain)
    {
        
        console.log('Player collided with:', otherBody);
        if (bodyMeshMap.has(otherBody)) {
            const mesh = bodyMeshMap.get(otherBody);
            console.log('Player collided with a tree:', mesh.name);
        }
    }
});

//MINIMAP SECTION
const minimapCanvas = document.createElement('canvas');
minimapCanvas.width = 200;
minimapCanvas.height = 200;
minimapCanvas.style.position = 'absolute';
minimapCanvas.style.bottom = '10px';
minimapCanvas.style.left = '10px';
minimapCanvas.style.border = '2px solid white';
document.body.appendChild(minimapCanvas);
const minimapContext = minimapCanvas.getContext('2d');

// Function to convert 3D world coordinates to 2D minimap coordinates
function worldToMinimap(x, z) {
  const minimapX = ((x + width / 2) / width) * minimapCanvas.width;
  const minimapZ = ((z + length / 2) / length) * minimapCanvas.height;
  return { x: minimapX, y: minimapZ };
}

// Function to update the minimap
function updateMinimap() {
  // Clear the minimap
  minimapContext.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  // Draw the terrain outline
  minimapContext.beginPath();
  minimapContext.moveTo(-width / 2, -length / 2);
  minimapContext.lineTo(-width / 2, length / 2);
  minimapContext.lineTo(width / 2, length / 2);
  minimapContext.lineTo(width / 2, -length / 2);
  minimapContext.closePath();
  minimapContext.strokeStyle = 'white';
  minimapContext.stroke();

  // Draw the structures
  minimapContext.fillStyle = 'grey';
  world.bodies.forEach(body => {
    if (body.shapes.length > 0) {
      const shape = body.shapes[0];
      if (shape instanceof CANNON.Box) {
        const halfExtents = shape.halfExtents;
        const { x, y } = worldToMinimap(body.position.x - halfExtents.x, body.position.z - halfExtents.z);
        const width = worldToMinimap(body.position.x + halfExtents.x, body.position.z - halfExtents.z).x - x;
        const height = worldToMinimap(body.position.x - halfExtents.x, body.position.z + halfExtents.z).y - y;
        minimapContext.fillRect(x, y, width, height);
      }
    }
  });

  // Draw the player marker
  const { x, y } = worldToMinimap(
    controls.object.position.x,
    controls.object.position.z
  );
  minimapContext.save();
  minimapContext.translate(x, y);
  minimapContext.rotate(-controls.object.rotation.y);
  minimapContext.beginPath();
  minimapContext.moveTo(0, 0);
  minimapContext.lineTo(10 * Math.cos(Math.PI / 4), 10 * Math.sin(Math.PI / 4));
  minimapContext.lineTo(10 * Math.cos(3 * Math.PI / 4), 10 * Math.sin(3 * Math.PI / 4));
  minimapContext.closePath();
  minimapContext.fillStyle = 'red';
  minimapContext.fill();
  minimapContext.restore();
}

//Life BAR
const lifeBarContainer = document.createElement('div');
lifeBarContainer.style.position = 'absolute';
lifeBarContainer.style.top = '20px';
lifeBarContainer.style.right = '20px';
lifeBarContainer.style.width = '110px'; // Container size slightly bigger than life bar
lifeBarContainer.style.height = '25px';
lifeBarContainer.style.backgroundColor = 'black'; // Retro black background
lifeBarContainer.style.border = '3px solid #888'; // Gray border for retro style
lifeBarContainer.style.boxShadow = '0 0 10px #000'; // Retro glowing effect

const lifeBar = document.createElement('div');
lifeBar.style.width = '100%'; // Full life bar starts at 100%
lifeBar.style.height = '100%';
lifeBar.style.backgroundColor = 'green'; // Healthy color
lifeBar.style.imageRendering = 'pixelated'; // Adds a pixelated effect for retro games
lifeBar.style.transition = 'width 0.3s'; // Smooth transition when life changes

lifeBarContainer.appendChild(lifeBar);
document.body.appendChild(lifeBarContainer);

//kill meter & level displayer
const killCount = document.createElement('div');
killCount.style.position = 'absolute';
killCount.style.top = '50px'; // Positioned below the life bar
killCount.style.right = '20px';
killCount.style.width = '110px';
killCount.style.height = '60px';
killCount.style.color = 'yellow'; // Flashy retro color
killCount.style.fontFamily = "'Press Start 2P', sans-serif"; // Blocky pixel font
killCount.style.fontSize = '18px';
killCount.style.textAlign = 'center';
killCount.style.backgroundColor = 'black';
killCount.style.border = '3px solid #888';
killCount.style.boxShadow = '0 0 10px #000';
killCount.style.padding = '5px';
killCount.style.imageRendering = 'pixelated'; // Retro pixelated effect
killCount.innerHTML = `Kills: 0<br>Level: 1`; // Initial kill count

document.body.appendChild(killCount);

function updateKillCount() {
    kills += 1;
    killCount.innerHTML = `Kills: ${kills}<br style="display:none;>Level: ${currentLevel}`;

}

function updateLevel(){
    currentLevel++
    killCount.innerHTML = `Kills: ${kills}<br style="display:none;>Level: ${currentLevel}`;

}

// Update life bar based on player's current life
function updateLifeBar() {
    const lifePercentage = (playerLife / 5) * 100; // Convert to percentage
    lifeBar.style.width = `${lifePercentage}%`; // Adjust based on life percentage

    if (lifePercentage <= 50) {
        lifeBar.style.backgroundColor = 'yellow'; // Change color when life is low
        
        MalescreamSound.pause();
        MalescreamSound.currentTime = 0;
        
    }
    if (lifePercentage <= 30) {
        lifeBar.style.backgroundColor = 'red'; // Critical life level
        MalescreamSound.play().catch(error => {
            console.error("Error playing scream sound:", error);
        });
        
    }
}

//game over screen

function createGameOverScreen() {
    gameOverScreen = document.createElement('div');
    gameOverScreen.style.position = 'absolute';
    gameOverScreen.style.top = '50%';
    gameOverScreen.style.left = '50%';
    gameOverScreen.style.transform = 'translate(-50%, -50%)';
    gameOverScreen.style.textAlign = 'center';
    gameOverScreen.style.color = 'orange';
    gameOverScreen.style.fontFamily = "'Press Start 2P', cursive";
    gameOverScreen.style.fontSize = '24px';
    gameOverScreen.style.display = 'none';
    gameOverScreen.innerHTML = `
        <h1 style="color: orange;">GAME OVER</h1>
        <p>PLAY AGAIN?</p>
        <button id="yes-btn" style="margin: 10px; padding: 5px 10px; font-family: inherit; font-size: 18px;">YES</button>
        <button id="no-btn" style="margin: 10px; padding: 5px 10px; font-family: inherit; font-size: 18px;">NO</button>
    `;
    document.body.appendChild(gameOverScreen);

    document.getElementById('yes-btn').addEventListener('click', restartGame);
    document.getElementById('no-btn').addEventListener('click', () => {
        // Do nothing when 'NO' is clicked, game remains in "Game Over" state
    });
}

// Call this function to initialize the game over screen
createGameOverScreen();


function checkGameOver() {
    if (playerLife <= 0 && !isGameOver) {
        isGameOver = true;
        playerLife = 0;
        updateLifeBar();
        showGameOverScreen();

        forestSound.pause();
        forestSound.currentTime = 0;
    }
}

function showGameOverScreen() {
    controls.unlock();
    gameOverScreen.style.display = 'block';
}

function restartGame() {
    
        window.location.reload();
  
}





addSun();
addMoon();
addSky();
addClouds();
addStars();
createTerrain();   
       

function addZombies(playerPosition) {
    const zombieCount = width * 0.01 * currentLevel; // Adjust based on desired density
    const maxAttempts = zombieCount * 10; // Maximum attempts to find valid positions
    let placedZombies = 0;
    let attempts = 0;

    while (placedZombies < zombieCount && attempts < maxAttempts) {
        attempts++;
        const x = Math.random() * width - width / 2;
        const z = Math.random() * width - width / 2;

        // Calculate the distance from the player to the potential zombie position
        const distanceToPlayer = Math.sqrt(Math.pow(playerPosition.x - x, 2) + Math.pow(playerPosition.z - z, 2));

        // Ensure the zombie is at least 150 units away from the player's position
        if (distanceToPlayer < 50) {
            continue; // Skip this iteration if the zombie is too close to the player
        }

        // Define the dimensions for the zombie bounding box
        const zombieWidth = 2; // Adjust as needed
        const zombieDepth = 2; // Adjust as needed

        // Check if the space is clear for the zombie
        if (!isSpaceClear(x, z, zombieWidth, zombieDepth)) {
            continue; // Skip this iteration if the space is not clear
        }

        // Create the zombie using the createZombie function
        new Zombie(loader, scene, zombies, world, characterBody);

        // Increment the count of placed zombies
        placedZombies++;
    }

    if (attempts >= maxAttempts) {
        console.log('Max attempts reached, could not place all zombies.');
    }
}

// Ensure that the isSpaceClear function is accessible
function isSpaceClear(x, z, structureWidth, depth) {
    const margin = 1; // Margin for the zombie bounding box
    const checkBox = new THREE.Box3(
        new THREE.Vector3(x - structureWidth / 2 - margin, 0, z - depth / 2 - margin),
        new THREE.Vector3(x + structureWidth / 2 + margin, 100, z + depth / 2 + margin)
    );

    // Check against existing obstacles
    for (let obstacle of obstacles) {
        if (checkBox.intersectsBox(obstacle.boundingBox)) {
            return false; // Space is not clear
        }
    }

    return true; // Space is clear
}

addZombies(controls.object.position);
    

function createWall() {
    const textureLoader = new THREE.TextureLoader();

    // Load wall bump map
    const wallBumpMap = textureLoader.load('wallbumpmap.jpg');

    // Configure the bump map so it doesn't tile too many times
    wallBumpMap.wrapS = wallBumpMap.wrapT = THREE.RepeatWrapping;
    wallBumpMap.repeat.set(1, 1); // Adjust this value to maintain the original aspect ratio

    // Define the geometry and material for the walls
    const wallGeometry = new THREE.BoxGeometry(width, 30, 1);

    // Use MeshPhongMaterial to support bump mapping
    const wallMaterial = new THREE.MeshPhongMaterial({
        color: 0x8B4513,  // A brown color for the walls
        bumpMap: wallBumpMap,
        bumpScale: 0.5,   // Adjust this value to control the intensity of the bump effect
        shininess: 10     // Adjust for desired shininess
    });

    // Function to create a wall and add it to the scene and physics world
    function createWallMeshAndBody(position, rotation = 0, width, height, depth) {
        const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
        wallMesh.position.copy(position);
        wallMesh.rotation.y = rotation;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        scene.add(wallMesh);

        const wallShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)); // Adjust size as needed
        const wallBody = new CANNON.Body({ mass: 0 }); // Static body
        wallBody.addShape(wallShape);
        wallBody.position.copy(position);
        wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
        world.addBody(wallBody);

        // Map the body to the mesh
        bodyMeshMap.set(wallBody, wallMesh);
    }

    // Create front wall
    createWallMeshAndBody(new THREE.Vector3(0, 15, -width / 2), 0, width, 30, 1);

    // Create back wall
    createWallMeshAndBody(new THREE.Vector3(0, 15, width / 2), 0, width, 30, 1);

    // Create left wall
    createWallMeshAndBody(new THREE.Vector3(-width / 2, 15, 0), Math.PI / 2, length, 30, 1);

    // Create right wall
    createWallMeshAndBody(new THREE.Vector3(width / 2, 15, 0), Math.PI / 2, length, 30, 1);
}

let worldTerrain;
function createTerrain() {
    const terrainWidth = width;
    const terrainLength = length;

    // Load the ground texture
    const loader = new THREE.TextureLoader();
    loader.load('ground.jpg', (groundTexture) => {
        // Repeat the texture over the terrain
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(terrainWidth / 10, terrainLength / 10); // Adjust the repeat to fit the terrain size

        // Create the geometry
        const terrainGeometry = new THREE.PlaneGeometry(terrainWidth, terrainLength);

        // Create the material for the terrain using the ground texture
        const terrainMaterial = new THREE.MeshLambertMaterial({
            map: groundTexture,  // Apply the ground texture
            wireframe: false     // Set to true if you want to see the mesh structure
        });

        // Create the terrain mesh
        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrain.rotation.x = -Math.PI / 2; // Rotate to lay flat
        terrain.receiveShadow = true;      // Allow the terrain to receive shadows

        // Add the terrain to the scene
        scene.add(terrain);

        // Create the Trimesh shape for Cannon.js
        const terrainShape = new CANNON.Plane();

        // Create the terrain body for Cannon.js
        const terrainBody = new CANNON.Body({ mass: 0 }); // Mass = 0 for static ground
        terrainBody.addShape(terrainShape);
        
        // Set the position and rotation to match the Three.js terrain
        terrainBody.position.set(0, 0, 0);
        terrainBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);

        // Add the terrain body to the world
        world.addBody(terrainBody);
        worldTerrain = terrainBody;

        // Optionally, create walls around the terrain
        createWall(terrainGeometry);
        addTrees();
        addStructures();
    });
}


    function addSun() {
        sun = new THREE.DirectionalLight(0xe6f0c5, 1);
        sun.position.set(0, 1000, 0); // Move sun high up
        sun.castShadow = true;

        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 1500;
        sun.shadow.camera.left = -500;
        sun.shadow.camera.right = 500;
        sun.shadow.camera.top = 500;
        sun.shadow.camera.bottom = -500;

        scene.add(sun);

        // Create a sky sphere
        const skyGeometry = new THREE.SphereGeometry(900, 32, 32);
        daySkyMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide });
        const sky = new THREE.Mesh(skyGeometry, daySkyMaterial);
        scene.add(sky);

        // Create sun sphere (visual representation)
        const sunGeometry = new THREE.SphereGeometry(40, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        sunMesh.position.set(0, 1000, 0); // Position sun in the sky sphere
        sky.add(sunMesh); // Add sun to the sky
    }

    function animateSun() {
            const time = Date.now() * 0.001;
            const radius = 700;
            sunMesh.position.x = Math.cos(time * 0.1) * radius;
            sunMesh.position.y = Math.sin(time * 0.1) * radius;

            // Update directional light position
            sun.position.copy(sunMesh.position);
            sun.position.multiplyScalar(1000 / radius);

          
        }

    function addMoon() {
        moon = new THREE.DirectionalLight(0xffffff, 0.5); // Dimmer than the sun
        moon.position.set(0, 1000, 0); // Position it high up, same as the sun
        moon.castShadow = true; // Moonlight usually does not cast shadows

        moon.shadow.mapSize.width = 2048;
        moon.shadow.mapSize.height = 2048;
        moon.shadow.camera.near = 0.5;
        moon.shadow.camera.far = 1500;
        moon.shadow.camera.left = -500;
        moon.shadow.camera.right = 500;
        moon.shadow.camera.top = 500;
        moon.shadow.camera.bottom = -500;
        moon.shadow.bias = -0.0155; 

        scene.add(moon);

        // Create a sky sphere
        const skyGeometry = new THREE.SphereGeometry(900, 32, 32);
       nightSkyMaterial = new THREE.MeshBasicMaterial({ color: 0x391f8f, side: THREE.BackSide });
        const sky = new THREE.Mesh(skyGeometry, nightSkyMaterial);
        scene.add(sky);

        const textureLoader = new THREE.TextureLoader();
    textureLoader.load('moon.jpg', function(texture) {
        // Create moon sphere (visual representation) with the texture
        const moonGeometry = new THREE.SphereGeometry(40, 32, 32);
        const moonMaterial = new THREE.MeshBasicMaterial({ map: texture }); // Use moon texture

        moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        moonMesh.position.set(0, 1000, 0); // Position moon in the sky sphere
        scene.add(moonMesh); // Add moon to the scene
    });
        
    }

    function animateMoon() {
        const time = Date.now() * 0.001;
        const radius = 700;
        moonMesh.position.x = Math.cos(time * 0.1 + Math.PI) * radius; // Moon follows opposite direction of sun
        moonMesh.position.y = Math.sin(time * 0.1 + Math.PI) * radius;

        // Update moon directional light position
        moon.position.copy(moonMesh.position);
        moon.position.multiplyScalar(1000 / radius);

        // Update sky color
        
    }

    function addSky() {
      const skyGeometry = new THREE.SphereGeometry(900, 32, 32);
      const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide });
      sky = new THREE.Mesh(skyGeometry, skyMaterial);
      scene.add(sky);
    }

    function addClouds() {
      clouds = new THREE.Group();
      const cloudGeometry = new THREE.SphereGeometry(5, 8, 8);
      const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8 });

      for (let i = 0; i < 100; i++) {
        const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloudPart.position.set(
          Math.random() * 800 - 400,
          Math.random() * 100 + 200,
          Math.random() * 800 - 400
        );
        cloudPart.scale.set(Math.random() * 2 + 1, Math.random() * 2 + 1, Math.random() * 2 + 1);
        clouds.add(cloudPart);
      }
      scene.add(clouds);
    }

    function addStars() {
      stars = new THREE.Group();
      const starGeometry = new THREE.SphereGeometry(0.7, 8, 8);
      const starMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

      for (let i = 0; i < 1000; i++) {
        const star = new THREE.Mesh(starGeometry, starMaterial);
        star.position.set(
          Math.random() * 1800 - 300,
          Math.random() * 1800 - 300,
          Math.random() * 1800 - 300
        );
        stars.add(star);
      }
      scene.add(stars);
    }

    function updateSkyColor() {
      const dayColor = new THREE.Color(0x87CEEB); // Blue sky
      const nightColor = new THREE.Color(0x192841); // Dark night sky
      const sunsetColor = new THREE.Color(0xFFA500); // Orange for sunset

      let t = (sunMesh.position.y + 700) / 1400; // Normalize sun position to [0, 1]
      t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]

      let skyColor;
      if (t > 0.7) {
        skyColor = dayColor;
        clouds.visible = true;
        stars.visible = false;
      } else if (t > 0.4) {
        skyColor = dayColor.lerp(sunsetColor, (t - 0.4) * (1 / 0.3));
        clouds.visible = true;
        stars.visible = false;
      } else if (t > 0.2) {
        skyColor = sunsetColor.lerp(nightColor, (t - 0.2) * (1 / 0.2));
        clouds.visible = false;
        stars.visible = true;
      } else {
        skyColor = nightColor;
        clouds.visible = false;
        stars.visible = true;
      }

      sky.material.color.copy(skyColor);

      // Adjust cloud opacity based on time of day
      if (clouds.visible) {
        const cloudOpacity = Math.min(1, Math.max(0, (t - 0.4) * 2));
        clouds.children.forEach(cloud => {
          cloud.material.opacity = cloudOpacity * 0.8;
        });
      }

      // Adjust star brightness based on time of day
      if (stars.visible) {
        const starBrightness = Math.min(1, Math.max(0, (0.4 - t) * 2));
        stars.children.forEach(star => {
          star.material.opacity = starBrightness;
        });
      }
    }



    function addTrees() {
        const treeCount = width * 0.05; // Number of trees
        const textureLoader = new THREE.TextureLoader();
        
        // Load textures
        const barkBumpMap = textureLoader.load('treebark.jpg');
        const leafTexture = textureLoader.load('leaves.avif');
    
        for (let i = 0; i < treeCount; i++) {
            const x = Math.random() * width - width / 2;
            const z = Math.random() * width - width / 2;
            
            // Randomize tree sizes
            const trunkHeight = 25 + Math.random() * 20;
            const trunkRadius = 2.5 + Math.random() * 3.5;
    
            // Create a physics body for the tree trunk
            const trunkShape = new CANNON.Cylinder(trunkRadius, trunkRadius * 1.2, trunkHeight, 16);
            const trunkBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(x, trunkHeight/2, z)}); // Static body
            trunkBody.addShape(trunkShape);
            world.addBody(trunkBody);
    
            // Create the tree trunk with bump map
            const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.2, trunkHeight, 16);
            const trunkMaterial = new THREE.MeshPhongMaterial({
                color: 0x8B4513,
                bumpMap: barkBumpMap,
                bumpScale: 0.7
            });
            
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(x, trunkHeight / 2, z);
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            scene.add(trunk);
    
            // Create low-poly tree leaves
            const leavesGroup = new THREE.Group();
            const leavesMaterial = new THREE.MeshPhongMaterial({
                color: 0x228B22,
                flatShading: true,
                map: leafTexture
            });
    
            for (let j = 0; j < 5; j++) {
                const leafGeometry = new THREE.IcosahedronGeometry(10 + Math.random() * 5, 0);
                const leaf = new THREE.Mesh(leafGeometry, leavesMaterial);
                const angle = (j / 5) * Math.PI * 2;
                const radius = 5 + Math.random() * 3;
                
                leaf.position.set(
                    Math.cos(angle) * radius,
                    trunkHeight + 5 + Math.random() * 5,
                    Math.sin(angle) * radius
                );
    
                const scale = 0.8 + Math.random() * 0.4;
                leaf.scale.set(scale, scale * 1.2, scale);
                leaf.rotation.set(
                    Math.random() * 0.5,
                    Math.random() * Math.PI * 2,
                    Math.random() * 0.5
                );
                
                leaf.castShadow = true;
                leaf.receiveShadow = true;
                leavesGroup.add(leaf);
            }
    
            // Add color variation
            leavesGroup.children.forEach(leaf => {
                leaf.material = leaf.material.clone();
                leaf.material.color.setHSL(
                    0.25 + Math.random() * 0.1,
                    0.5 + Math.random() * 0.2,
                    0.4 + Math.random() * 0.2
                );
            });
    
            leavesGroup.position.set(x, 0, z);
            scene.add(leavesGroup);
        }
    }

    function addStructures() {
        const structureCount = width * 0.01;
        const textureLoader = new THREE.TextureLoader();
        // Load texture maps
        const baseColorMap = textureLoader.load('Wall_Stone_010_basecolor.jpg');
        const normalMap = textureLoader.load('Wall_Stone_010_normal.jpg');
        const roughnessMap = textureLoader.load('Wall_Stone_010_roughness.jpg');
        const heightMap = textureLoader.load('Wall_Stone_010_height.png');  // Also known as displacement map
        const aoMap = textureLoader.load('Wall_Stone_010_ambientOcclusion.jpg');
    
        const brickMaterial = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            map: baseColorMap,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            displacementMap: heightMap,
            displacementScale: 0.8,
            aoMap: aoMap,
            roughness: 0.8,
            metalness: 0.8
        });
    
        // Ensure that openingHeight and openingWidth are defined
        const openingHeight = 25; // Example value, adjust as needed
        const openingWidth = 15;  // Example value, adjust as needed
    
        function isSpaceClear(x, z, structureWidth, depth) {
            const margin = 5; // Add a small margin around structures
            const checkBox = new THREE.Box3(
                new THREE.Vector3(x - structureWidth / 2 - margin, 0, z - depth / 2 - margin),
                new THREE.Vector3(x + structureWidth / 2 + margin, 100, z + depth / 2 + margin)
            );
        
            // Check against existing physics bodies
            for (let body of world.bodies) {
                if (body.shapes.length > 0) {
                    const shape = body.shapes[0];
                    if (shape instanceof CANNON.Box || shape instanceof CANNON.Cylinder) {
                        const halfExtents = shape.halfExtents || new CANNON.Vec3(shape.radiusTop, shape.height / 2, shape.radiusTop);
                        const bodyBox = new THREE.Box3(
                            new THREE.Vector3(body.position.x - halfExtents.x, body.position.y - halfExtents.y, body.position.z - halfExtents.z),
                            new THREE.Vector3(body.position.x + halfExtents.x, body.position.y + halfExtents.y, body.position.z + halfExtents.z)
                        );
                        if (checkBox.intersectsBox(bodyBox)) {
                            return false;
                        }
                    }
                }
            }
        
            return true;
        }
    
        let placedStructures = 0;
        let attempts = 0;
        const maxAttempts = structureCount * 10;
    
        // Try placing structures until the desired count or max attempts is reached
        while (placedStructures < structureCount && attempts < maxAttempts) {
            attempts++;
            const x = Math.random() * width - width / 2;
            const z = Math.random() * width - width / 2;
    
            const structureWidth = 25 + Math.random() * 15;
            const depth = 20 + Math.random() * 15;
            const height = 35 + Math.random() * 15;
    
            if (!isSpaceClear(x, z, structureWidth, depth)) {
                continue;  // Skip this iteration if the space is not clear
            }
    
            // Create a group to hold all parts of the structure
            const structureGroup = new THREE.Group();
            const wallThickness = 1;
    
            const powerUpType = Object.values(powerUpTypes)[Math.floor(Math.random() * Object.keys(powerUpTypes).length)];
            const powerUp = new PowerUp(powerUpType, new THREE.Vector3(x, height * 0.1, z), scene, loadPowerUp);
            powerUps.push(powerUp);
    
            // Create walls with more segments for better displacement
            const wallGeometry = new THREE.BoxGeometry(wallThickness, height, depth, 1, 50, 50);
    
            // Left wall
            const leftWall = new THREE.Mesh(wallGeometry, brickMaterial);
            leftWall.position.set(-structureWidth / 2, height / 2, 0);  // Check thickness alignment
            structureGroup.add(leftWall);
    
            // Right wall
            const rightWall = new THREE.Mesh(wallGeometry, brickMaterial);
            rightWall.position.set(structureWidth / 2, height / 2, 0);  // Check thickness alignment
            structureGroup.add(rightWall);
    
            // Back wall
            const backWallGeometry = new THREE.BoxGeometry(structureWidth, height, 1);
            const backWall = new THREE.Mesh(backWallGeometry, brickMaterial);
            backWall.position.set(0, height / 2, -depth / 2 + 0.5);  // Adjust for wall thickness
            structureGroup.add(backWall);
    
            // Front wall with opening adjustments
            const frontWallTopGeometry = new THREE.BoxGeometry(structureWidth, height - openingHeight, 1);
            const frontWallTop = new THREE.Mesh(frontWallTopGeometry, brickMaterial);
            frontWallTop.position.set(0, height - (height - openingHeight) / 2, depth / 2 - 0.5);  // Center top wall
            structureGroup.add(frontWallTop);
    
            // Adjusted left and right segments of the front wall
            const frontWallSideGeometry = new THREE.BoxGeometry((structureWidth - openingWidth) / 2, openingHeight, 1);
            const frontWallLeft = new THREE.Mesh(frontWallSideGeometry, brickMaterial);
            frontWallLeft.position.set(-(structureWidth / 2 - (structureWidth - openingWidth) / 4), openingHeight / 2, depth / 2 - 0.5);
            structureGroup.add(frontWallLeft);
    
            const frontWallRight = new THREE.Mesh(frontWallSideGeometry, brickMaterial);
            frontWallRight.position.set(structureWidth / 2 - (structureWidth - openingWidth) / 4, openingHeight / 2, depth / 2 - 0.5);
            structureGroup.add(frontWallRight);
    
            // Roof
            const roofGeometry = new THREE.BoxGeometry(structureWidth, 1, depth);
            const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7, metalness: 0.2 });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.set(0, height + 0.5, 0);  // Adjust roof position to sit on top of walls
            structureGroup.add(roof);
    
            // Final structure positioning
            structureGroup.position.set(x, 0, z); // Place structures directly on the flat terrain
            scene.add(structureGroup); // Add the structure group to the scene
    
            // Create physics bodies for each wall
            const leftWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, height / 2, depth / 2));
            const rightWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, height / 2, depth / 2));
            const backWallShape = new CANNON.Box(new CANNON.Vec3(structureWidth / 2, height / 2, wallThickness / 2));
            const frontWallTopShape = new CANNON.Box(new CANNON.Vec3(structureWidth / 2, (height - openingHeight) / 2, wallThickness / 2));
            const frontWallSideShape = new CANNON.Box(new CANNON.Vec3((structureWidth - openingWidth) / 4, openingHeight / 2, wallThickness / 2));
            const roofShape = new CANNON.Box(new CANNON.Vec3(structureWidth / 2, 0.5, depth / 2));
    
            const leftWallBody = new CANNON.Body({ mass: 0 });
            leftWallBody.addShape(leftWallShape);
            leftWallBody.position.set(x - structureWidth / 2, height / 2, z);
            world.addBody(leftWallBody);
    
            const rightWallBody = new CANNON.Body({ mass: 0 });
            rightWallBody.addShape(rightWallShape);
            rightWallBody.position.set(x + structureWidth / 2, height / 2, z);
            world.addBody(rightWallBody);
    
            const backWallBody = new CANNON.Body({ mass: 0 });
            backWallBody.addShape(backWallShape);
            backWallBody.position.set(x, height / 2, z - depth / 2 + wallThickness / 2);
            world.addBody(backWallBody);
    
            const frontWallTopBody = new CANNON.Body({ mass: 0 });
            frontWallTopBody.addShape(frontWallTopShape);
            frontWallTopBody.position.set(x, height / 2 + openingHeight / 2, z + depth / 2 - wallThickness / 2);
            world.addBody(frontWallTopBody);
    
            const frontWallLeftBody = new CANNON.Body({ mass: 0 });
            frontWallLeftBody.addShape(frontWallSideShape);
            frontWallLeftBody.position.set(x - structureWidth / 4 - openingWidth / 4, openingHeight / 2, z + depth / 2 - wallThickness / 2);
            world.addBody(frontWallLeftBody);
    
            const frontWallRightBody = new CANNON.Body({ mass: 0 });
            frontWallRightBody.addShape(frontWallSideShape);
            frontWallRightBody.position.set(x + structureWidth / 4 + openingWidth / 4, openingHeight / 2, z + depth / 2 - wallThickness / 2);
            world.addBody(frontWallRightBody);
    
            const roofBody = new CANNON.Body({ mass: 0 });
            roofBody.addShape(roofShape);
            roofBody.position.set(x, height - 0.5, z);
            world.addBody(roofBody);
    
            // Map the bodies to the meshes
            // bodyMeshMap.set(leftWallBody, leftWall);
            // bodyMeshMap.set(rightWallBody, rightWall);
            // bodyMeshMap.set(backWallBody, backWall);
            // bodyMeshMap.set(frontWallTopBody, frontWallTop);
            // bodyMeshMap.set(frontWallLeftBody, frontWallLeft);
            // bodyMeshMap.set(frontWallRightBody, frontWallRight);
            // bodyMeshMap.set(roofBody, roof);
    
            placedStructures++;
        }
    
        if (attempts >= maxAttempts) {
            console.log('Max attempts reached, could not place all structures.');
        }
    }

function checkPowerUpCollection() {
  
    const player = controls.object.position;

    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
       

        if (player.distanceTo(powerUp.position)<10 && powerUp.isActive) {
            console.log('player speed before:'+moveSpeed + "\n"+ 'zombiespeed before :'+zombieSpeed + "\n"+'player health before:'+playerLife)

            
            powerUp.collect(moveSpeed,zombieSpeed,playerLife); // Collect the power-up
            powerUps.splice(i, 1); // Remove from the active list
            updateLifeBar(); // Update the life bar

            console.log('powerup activated!!:'+powerUp.type)
            console.log('player speed after:'+moveSpeed + "\n"+ 'zombiespeed after:'+zombieSpeed + "\n"+'player health after:'+playerLife)
        }
    }
}



function getRandomAction(zombie, actions) {
    actions = actions.filter(action => action); // Filter out undefined actions
    const randomIndex = Math.floor(Math.random() * actions.length);
    return actions[randomIndex];
}




function switchAction(zombie, toAction) {
    if (zombie.activeAction !== toAction) {
        if (zombie.activeAction) zombie.activeAction.fadeOut(0.5); // Smooth transition between animations
        toAction.reset().fadeIn(0.5).play(); // Play the new animation
        zombie.activeAction = toAction; // Update the active action
    }
}


function avoidObstacles(zombiePosition, directionToPlayer, obstacles, zombieSpeed, delta) {
    const avoidanceForce = new THREE.Vector3();
    const avoidanceStrength = 10; // Increased from 5
    const minimumSeparation = 2; // Minimum distance to keep from obstacles

    // Create a slightly larger bounding box for the zombie
    const zombieBox = new THREE.Box3().setFromCenterAndSize(zombiePosition, new THREE.Vector3(3, 3, 3));

    let avoiding = false;

    obstacles.forEach(obstacle => {
        if (obstacle.boundingBox.intersectsBox(zombieBox)) {
            avoiding = true;

            const closestPoint = obstacle.boundingBox.clampPoint(zombiePosition, new THREE.Vector3());
            const avoidDirection = new THREE.Vector3().subVectors(zombiePosition, closestPoint).normalize();
            
            // Calculate distance to obstacle surface
            const distanceToObstacle = zombiePosition.distanceTo(closestPoint);
            
            // Apply stronger avoidance force when very close to obstacle
            const scaleFactor = Math.max(0, minimumSeparation - distanceToObstacle) * avoidanceStrength;
            
            avoidanceForce.add(avoidDirection.multiplyScalar(scaleFactor));
        }
    });

    if (avoiding && avoidanceForce.length() > 0) {
        const blendedDirection = new THREE.Vector3()
            .addVectors(directionToPlayer, avoidanceForce)
            .normalize();

        // Use raycasting to check for collisions along the path
        // Now apply movement and check validity with bounding boxes
        const newPosition = zombiePosition.clone().add(blendedDirection.multiplyScalar(zombieSpeed * delta));
        const newZombieBox = new THREE.Box3().setFromCenterAndSize(newPosition, new THREE.Vector3(3, 3, 3));

        // Check if the new position is valid
        const canMove = !obstacles.some(obstacle => obstacle.boundingBox.intersectsBox(newZombieBox));

        if (canMove) {
            // Update the zombie's position if valid
            zombiePosition.copy(newPosition);
        }


        return blendedDirection.multiplyScalar(zombieSpeed * delta);
    }

    return directionToPlayer.multiplyScalar(zombieSpeed * delta);
}

function handleZombies(delta) {
    zombies.forEach(zombie => {
        // Update the zombie
        zombie.update(delta, controls);

        // Handle zombie death
        if (!zombie.isDead && isShiftPressed) {
            zombie.getShot(1); // Decrease life by 1 when shift is pressed
        }

        // Smooth zombie movement when alive and distance is greater than minimum
        const zombiePosition = new THREE.Vector3();
        const cameraPosition = new THREE.Vector3(controls.object.position.x, 0, controls.object.position.z);
        zombie.model.getWorldPosition(zombiePosition);

        const direction = new THREE.Vector3().subVectors(cameraPosition, zombiePosition).normalize();
        const distanceToCamera = zombiePosition.distanceTo(cameraPosition);

        if (distanceToCamera > 1.5) {
            const avoidanceDirection = avoidObstacles(zombiePosition, direction, obstacles, zombieSpeed, delta);

            // Ensure the avoidance direction is valid and apply it
            if (!isNaN(avoidanceDirection.x) && !isNaN(avoidanceDirection.y) && !isNaN(avoidanceDirection.z)) {
                const newPosition = zombiePosition.clone().add(avoidanceDirection);
                
                // Check if the new position is valid (not inside any obstacle)
                const newZombieBox = new THREE.Box3().setFromCenterAndSize(newPosition, new THREE.Vector3(2, 2, 2));
                const canMove = !obstacles.some(obstacle => obstacle.boundingBox.intersectsBox(newZombieBox));
                
                if (canMove) {
                    zombie.model.position.copy(newPosition);
                    zombie.body.position.copy(newPosition); // Sync physics body with Three.js mesh
                }
            }
        } else {
            if (playerLife > 0) {
                playerLife -= 0.5 * delta; // Decrement by 0.5 per second
                updateLifeBar(); // Update the life bar based on player's life
                if (playerLife <= 0) {
                    playerLife = 0;
                    alert('Game Over'); // End game if player's life reaches zero
                }
            }
        }
    });
}

// Update loop
function updatePhysics(deltaTime) {
    world.step(deltaTime);

    // Apply movement
    const velocity = characterBody.velocity;
    velocity.x = 0;
    velocity.z = 0;

    const speed = 10;

    const direction = new THREE.Vector3();
    controls.getDirection(direction);

    if (moveForward) {
        velocity.x += direction.x * speed;
        velocity.z += direction.z * speed;
    }
    if (moveBackward) {
        velocity.x -= direction.x * speed;
        velocity.z -= direction.z * speed;
    }
    if (moveLeft) {
        velocity.x += direction.z * speed;
        velocity.z -= direction.x * speed;
    }
    if (moveRight) {
        velocity.x -= direction.z * speed;
        velocity.z += direction.x * speed;
    }

    // Update camera position
    camera.position.set(characterBody.position.x, characterBody.position.y + 1.5, characterBody.position.z);

    //controls.object.position.copy(characterBody.position);
    //camera.position.y = 3; // Adjust the camera height as needed

    if (worldTerrain && !isOnGround) {
        checkIfOnGround();
    }

   handleZombies(deltaTime);

    // Remove paintballs marked for removal
    updatePaintballs(world, scene);

    bodyMeshMap.forEach((mesh, body) => {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
    });
}

// Function to check if the character is on the ground
function checkIfOnGround() {
    const ray = new CANNON.Ray();
    ray.from = new CANNON.Vec3().copy(characterBody.position);
    ray.to = new CANNON.Vec3(characterBody.position.x, characterBody.position.y - 1, characterBody.position.z); // Cast ray downward

    const result = new CANNON.RaycastResult();
    ray.intersectBody(worldTerrain, result);

    isOnGround = result.hasHit;
}
       
        let moveForward = false;
        let moveBackward = false;
        let moveLeft = false;
        let moveRight = false;
        let canJump = false;
        let velocityY = 0;
        const gravity = -9.8;
        const jumpHeight = 5;
        let isOnGround = true;
        let isShiftPressed = false;

        const onKeyDown = function (event) {
            switch (event.code) {
                case 'ShiftLeft':
                    isShiftPressed = true;
                    break;
            
                case 'KeyP':
                    if (isPaused) {
                        resumeGame();
                    } else {
                        pauseGame();
                    }
                    break;

                case 'KeyW':
                    moveForward = true;
                    break;
                case 'KeyA':
                    moveLeft = true;
                    break;
                case 'KeyS':
                    moveBackward = true;
                    break;
                case 'KeyD':
                    moveRight = true;
                    break;
                case 'Space':
                    if (isOnGround) {
                        console.log("Jumping"); 
                        characterBody.velocity.y = jumpHeight;
                        isOnGround = false;
                    }
                    break;
            }
        };

        const onKeyUp = function (event) {
            switch (event.code) {
                case 'ShiftLeft':
                    isShiftPressed = false;
                    break;
                case 'KeyW':
                    moveForward = false;
                    break;
                case 'KeyA':
                    moveLeft = false;
                    break;
                case 'KeyS':
                    moveBackward = false;
                    break;
                case 'KeyD':
                    moveRight = false;
                    break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Animation loop
        const clock = new THREE.Clock();
        function animate() {
            const delta = clock.getDelta();
            const val = 1/60;
            updatePhysics(val);
            
            checkGameOver();
            
            if (!isPaused) {

                requestAnimationFrame(animate);
                animateSun();
                animateMoon();
                updateSkyColor();
                updateMinimap();
                checkPowerUpCollection();
                renderer.render(scene, camera);
            }
           
        }
        animate();

        // Handle window resizing
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();

            renderer.setSize(window.innerWidth, window.innerHeight);
        });