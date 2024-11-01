import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Zombie {
    constructor(loader, scene, zombies, world) {
        this.position = this.getRandomPosition(); // Randomly choose position
        this.loader = loader;
        this.scene = scene;
        this.zombies = zombies;
        this.kills = 0;
        this.world = world;
        this.speed = 0.05;
        this.attackDistance = 3.0;
        this.idleDistance = 10.0;
        this.model = null;
        this.mixer = null;
        this.isDead = false;
        this.life = 10; // Initial life
        this.actionChosen = false;
        this.chosenAction = null;
        this.activeAction = null;
        this.animations = {}; // Store the loaded animations
        this.collisionDistance = 10; // Minimum distance between zombies to avoid collision
        this.body = null; // Physics body

        // List of available zombie models (textures)
        this.availableSkins = [
            '/assets/models/zombie1.fbx', '/assets/models/zombie2.fbx', '/assets/models/zombie3.fbx',
            '/assets/models/zombie4.fbx', '/assets/models/zombie5.fbx', '/assets/models/zombie6.fbx',
            '/assets/models/Mutant.fbx'
        ];

        this.chaseAnimations = ['/assets/models/chase1.fbx', '/assets/models/chase2.fbx'];
        this.attackAnimations = ['/assets/models/Attack1.fbx', '/assets/models/Attack2.fbx'];
        this.idleAnimations = ['/assets/models/idle1.fbx', '/assets/models/idle2.fbx'];
        this.dyingAnimations = ['/assets/models/ZDying.fbx', '/assets/models/ZDeath.fbx'];

        // Animation properties
        this.currentChaseAnimation = null;
        this.currentAttackAnimation = null;
        this.currentIdleAnimation = null;
        this.currentDyingAnimation = null;

        // Choose a random skin from availableSkins
        this.skin = this.getRandomSkin();

        // Load the zombie model and animations
        this.loadModel();
    }

    // Method to randomly select a skin from availableSkins
    getRandomSkin() {
        const randomIndex = Math.floor(Math.random() * this.availableSkins.length);
        return this.availableSkins[randomIndex];
    }

    // Method to randomly choose a position within a certain range
    getRandomPosition() {
        const minX = -300, maxX = 300;
        const minZ = -300, maxZ = 300;

        const randomX = Math.random() * (maxX - minX) + minX;
        const randomZ = Math.random() * (maxZ - minZ) + minZ;

        return new THREE.Vector3(randomX, 0, randomZ); // Set y to 0 for ground level
    }

    loadModel() {
        this.loader.load(this.skin, (fbx) => {
            this.model = fbx;
            this.model.scale.set(0.016, 0.016, 0.016);
            this.model.position.copy(this.position);
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.scene.add(this.model);
            this.mixer = new THREE.AnimationMixer(fbx);

            // Load animations
            this.loadChaseAnimation();
            this.loadAttackAnimation();
            this.loadIdleAnimation();
            this.loadDyingAnimation();

            this.zombies.push(this);

            // Create physics body for the zombie
            this.createPhysicsBody();

            console.log('Zombie added to the scene:', this.model);
        }, undefined, (error) => {
            console.error('Error loading zombie model:', error);
        });
    }

    loadChaseAnimation() {
        const randomChase = this.chaseAnimations[Math.floor(Math.random() * this.chaseAnimations.length)];

        this.loader.load(randomChase, (fbx) => {
            const action = fbx.animations[0];
            if (action) {
                this.currentChaseAnimation = this.mixer.clipAction(action);
                this.currentChaseAnimation.setLoop(THREE.LoopRepeat);
            }
        });
    }

    loadAttackAnimation() {
        const randomAttack = this.attackAnimations[Math.floor(Math.random() * this.attackAnimations.length)];

        this.loader.load(randomAttack, (fbx) => {
            const action = fbx.animations[0];
            if (action) {
                this.currentAttackAnimation = this.mixer.clipAction(action);
                this.currentAttackAnimation.setLoop(THREE.LoopRepeat);
            }
        });
    }

    loadIdleAnimation() {
        const randomIdle = this.idleAnimations[Math.floor(Math.random() * this.idleAnimations.length)];

        this.loader.load(randomIdle, (fbx) => {
            const action = fbx.animations[0];
            if (action) {
                this.currentIdleAnimation = this.mixer.clipAction(action);
                this.currentIdleAnimation.setLoop(THREE.LoopRepeat);
            }
        });
    }

    loadDyingAnimation() {
        const randomDie = this.dyingAnimations[Math.floor(Math.random() * this.dyingAnimations.length)];

        this.loader.load(randomDie, (fbx) => {
            const action = fbx.animations[0];
            if (action) {
                this.currentDyingAnimation = this.mixer.clipAction(action);
                this.currentDyingAnimation.setLoop(THREE.LoopOnce);
            }
        });
    }

    // Create physics body for the zombie
    createPhysicsBody() {
        const shape = new CANNON.Box(new CANNON.Vec3(1, 2, 1)); // Adjust size to match the zombie height
        this.body = new CANNON.Body({ mass: 1 });
        this.body.addShape(shape);
        this.body.position.set(this.position.x, this.position.y / 2, this.position.z); // Set y to half the height of the shape
        this.body.userData = { type: 'zombie' }; // Add user data for collision detection
        this.world.addBody(this.body);
    }

    getShot(damage) {
        this.life -= damage;
        console.log(`Zombie hit! Remaining life: ${this.life}`);
        if (this.life <= 0) {
            console.log('Zombie killed!');
            this.die();
        }
    }

    // Method to handle dying
    die() {
        this.isDead = true;
        this.kills++;
        if (this.currentDyingAnimation) {
            this.playAnimation(this.currentDyingAnimation);
        }
        setTimeout(() => {
            this.remove();
        }, 5000); // Remove the zombie after 5 seconds
    }

    remove() {
        if (this.model) {
            this.scene.remove(this.model);
            this.model = null;
        }
        if (this.body) {
            this.world.removeBody(this.body);
            this.body = null;
        }
        const index = this.zombies.indexOf(this);
        if (index > -1) {
            this.zombies.splice(index, 1);
        }
    }

    // Check collision with other zombies and avoid them
    avoidCollisionWithOtherZombies() {
        this.zombies.forEach(zombie => {
            if (zombie !== this && !zombie.isDead) {
                const distance = this.model.position.distanceTo(zombie.model.position);
                if (distance < this.collisionDistance) {
                    // Adjust direction to avoid the collision
                    const directionAway = new THREE.Vector3().subVectors(this.model.position, zombie.model.position).normalize();
                    this.model.position.add(directionAway.multiplyScalar(1)); // Move 1 unit away
                    this.body.position.copy(this.model.position); // Sync physics body with Three.js mesh
                }
            }
        });
    }

    update(delta, controls) {
        if (this.mixer) this.mixer.update(delta);

        const zombiePosition = new THREE.Vector3();
        const cameraPosition = new THREE.Vector3(controls.object.position.x, 0, controls.object.position.z);
        this.model.getWorldPosition(zombiePosition);

        const direction = new THREE.Vector3().subVectors(cameraPosition, zombiePosition).normalize();
        this.model.lookAt(cameraPosition);

        const distanceToCamera = zombiePosition.distanceTo(cameraPosition);

        // Avoid collision with other zombies
        this.avoidCollisionWithOtherZombies();

        // 1. If far from the camera (> 50), play idle action
        if (distanceToCamera > 50) {
            if (this.currentIdleAnimation) {
                this.playAnimation(this.currentIdleAnimation);
            }
        }
        // 2. If close to the camera (within 10), attack
        else if (distanceToCamera <= 5) {
            if (!this.actionChosen) {
                this.chosenAction = this.currentAttackAnimation;
                this.actionChosen = true;
            }

            if (this.chosenAction) {
                this.playAnimation(this.chosenAction);
            }
        }
        // 3. If in between (between 10 and 50), move towards the camera and run
        else {
            this.actionChosen = false; // Reset chosen action
            this.model.position.add(direction.multiplyScalar(this.speed)); // Move zombie
            this.body.position.copy(this.model.position); // Sync physics body with Three.js mesh

            // Play running animation
            if (this.currentChaseAnimation) {
                this.currentChaseAnimation.timeScale = this.speed / 16;
                this.playAnimation(this.currentChaseAnimation);
            }
        }

        // Ensure zombies stay within the world bounds
        this.checkBounds();
    }

    // Ensure zombies stay within the world bounds
    checkBounds() {
        const minX = -300, maxX = 300;
        const minY = 0, maxY = 0; // Keeping Y as 1 for ground level
        const minZ = -300, maxZ = 300;

        if (this.model.position.x < minX) this.model.position.x = minX;
        if (this.model.position.x > maxX) this.model.position.x = maxX;
        if (this.model.position.y < minY) this.model.position.y = minY;
        if (this.model.position.y > maxY) this.model.position.y = maxY;
        if (this.model.position.z < minZ) this.model.position.z = minZ;
        if (this.model.position.z > maxZ) this.model.position.z = maxZ;

        this.body.position.set(this.model.position.x, this.model.position.y, this.model.position.z); // Sync physics body with Three.js mesh
    }

    getRandomAction(actions) {
        actions = actions.filter(action => action); // Filter out undefined actions
        const randomIndex = Math.floor(Math.random() * actions.length);
        return actions[randomIndex];
    }

    playAnimation(animation) {
        if (animation && !animation.isRunning()) {
            this.mixer.stopAllAction();
            animation.play();
        }
    }
}

export default Zombie;