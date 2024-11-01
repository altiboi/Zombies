import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { world, bodyMeshMap} from './world.js';

export let worldTerrain;
export function createTerrain(width, length, scene) {
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
        createWall(width, length, scene);
        addTrees(width, length, scene);
        addStructures(width, length, scene);
    });
}

function createWall(width, length, scene) {
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

function addTrees(width, length, scene) {
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

function addStructures(width, length, scene) {
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

        placedStructures++;
    }

    if (attempts >= maxAttempts) {
        console.log('Max attempts reached, could not place all structures.');
    }
}