import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { gsap } from 'gsap/gsap-core';
class Zombie {
    constructor(loader, scene, zombies, world) {
        this.position = this.getRandomPosition(); // Randomly choose position
        this.loader = loader;
        this.scene = scene;
        this.zombies = zombies;
        this.kills = 0;
        this.world = world;
        this.model = null;
        this.mixer = null;
        this.isDead = false;
        this.maxLife = 8; // Maximum life
        this.life = 8; // Initial life
        this.lifeBar = null; // Life bar sprite
        this.actionChosen = false;
        this.chosenAction = null;
        this.activeAction = null;
        this.animations = {}; // Store the loaded animations
        this.collisionDistance = 2; // Minimum distance between zombies to avoid collision
        this.body = null; // Physics body
        this.isAlerted = false;

        // List of available zombie models (textures)
        this.availableSkins = [
            '/assets/models/zombie1.fbx', '/assets/models/zombie2.fbx', '/assets/models/zombie3.fbx',
            '/assets/models/zombie4.fbx', '/assets/models/zombie5.fbx', '/assets/models/zombie6.fbx',
            '/assets/models/Mutant.fbx'
        ];

        this.availableAudios = ['/assets/audio/girlzombie.mp3','/assets/audio/yakuzazombie.mp3','/assets/audio/warzombie.mp3'];

        this.chaseAnimations = ['/assets/models/chase1.fbx', '/assets/models/chase2.fbx'];
        this.attackAnimations = ['/assets/models/Attack1.fbx', '/assets/models/Attack2.fbx'];
        this.idleAnimations = ['/assets/models/idle1.fbx', '/assets/models/idle2.fbx'];
        this.dyingAnimations = ['/assets/models/ZDying.fbx', '/assets/models/ZDeath.fbx'];

        // Animation properties
        this.currentChaseAnimation = null;
        this.currentAttackAnimation = null;
        this.currentIdleAnimation = null;
        this.currentDyingAnimation = null;
        this.speed = 0.03;
        this.attackDistance = 3.0;
        this.idleDistance = 200.0;

        this.idleDuration = 5; // Duration in seconds to play idle before switching
        this.idleTimer = 0; // Timer for tracking idle duration
        this.inIdleAnimation = false; // State to track if currently in idle animation

        // Choose a random skin from availableSkins
        this.skin = this.getRandomSkin();
        this.sound = this.getRandomSound();
        this.sound.volume = 0.1; 

        // Load the zombie model and animations
        this.loadModel();
        this.createLifeBar();
    }

    // Method to randomly select a skin from availableSkins
    getRandomSkin() {
        const randomIndex = Math.floor(Math.random() * this.availableSkins.length);
        return this.availableSkins[randomIndex];
    }

    getRandomSound() {
        const randomIndex = Math.floor(Math.random() * this.availableAudios.length);
        return new Audio(this.availableAudios[randomIndex]);
    }

    // Method to randomly choose a position within a certain range
    getRandomPosition() {
        const minX = -200, maxX = 200;
        const minZ = -200, maxZ = 200;

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

            //console.log('Zombie added to the scene:', this.model);
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
            } else {
                console.error("Chase animation not found in the loaded FBX file.");
            }
        }, undefined, (error) => {
            console.error("Error loading chase animation:", error);
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
                this.currentDyingAnimation.setLoop(THREE.LoopOnce); // Set to not loop on death
            } else {
                console.error("Dying animation not found in the loaded FBX file.");
            }
        }, undefined, (error) => {
            console.error("Error loading dying animation:", error);
        });
    }

    // Create physics body for the zombie
    createPhysicsBody() {
        const shape = new CANNON.Box(new CANNON.Vec3(0.55, 2.7, 0.55)); // Adjust size to match the zombie height
        this.body = new CANNON.Body({ mass: 1 });
        this.body.addShape(shape);
        this.body.position.set(this.position.x, this.position.y / 2, this.position.z); // Set y to half the height of the shape
        this.body.userData = { type: 'zombie' }; // Add user data for collision detection
        this.world.addBody(this.body);
    }

    // Create life bar for the zombie
    createLifeBar() {
        const lifeBarMaterial = new THREE.SpriteMaterial({ color: 0xff0000 });
        this.lifeBar = new THREE.Sprite(lifeBarMaterial);
        this.lifeBar.scale.set(1, 0.1, 1); // Adjust the size of the life bar
        this.scene.add(this.lifeBar);
    }

    // Update the life bar based on the zombie's current life
    updateLifeBar() {
        const lifePercentage = this.life / this.maxLife;
        if (this.lifeBar) {
            this.lifeBar.material.color.setHSL((lifePercentage * 0.3), 1, 0.5); // Change color based on life percentage
            this.lifeBar.scale.set(lifePercentage, 0.1, 1); // Adjust the width based on life percentage
            this.lifeBar.position.set(this.model.position.x, this.model.position.y + 3, this.model.position.z); // Position above the zombie
            this.lifeBar.visible = true; // Ensure the life bar is visible when the zombie is alive
        }
    }

    getShot(damage) {
        this.life -= damage;
        console.log(`Zombie hit! Remaining life: ${this.life}`);
        if (this.life <= 0 && !this.isDead) {
            this.die();
        }
    }

    die() {
        console.log("Zombie has died.");
        this.isDead = true;
        this.lifeBar.visible = false; // Hide the life bar when the zombie is dead
        this.sound.pause();

        // Stop all current animations
        if (this.mixer) {
            this.mixer.stopAllAction();
        }

        // If we have a death animation, play it once
        if (this.currentDyingAnimation) {
            this.currentDyingAnimation.reset();
            this.currentDyingAnimation.setLoop(THREE.LoopOnce);

            // Slow down the dying animation
            this.currentDyingAnimation.timeScale = 0.4; // Adjust the timeScale to slow down the animation
            this.currentDyingAnimation.play();

            // Set the duration of the fade-out based on the animation duration
            const deathDuration = (this.currentDyingAnimation.getClip().duration / this.currentDyingAnimation.timeScale) - 5;
            console.log(`Death duration: ${deathDuration} seconds`);

            // Function to handle removing the model and body
            const onFinished = () => {
                if (this.scene && this.model) {
                    this.scene.remove(this.model);
                    this.model = null;
                }
                if (this.world && this.body) {
                    this.world.removeBody(this.body);
                    this.body = null;
                }
                if (this.lifeBar) {
                    this.scene.remove(this.lifeBar);
                    this.lifeBar = null;
                }
            };

            // Delay the fade-out until the animation is nearly done
            const fadeOutStart = deathDuration - 1; // Start fading 1 second before end
            if (this.model) {
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.material.transparent = true; // Enable opacity fading

                        // Use GSAP to fade out opacity
                        gsap.to(child.material, {
                            opacity: 0,
                            duration: 1, // Fade duration
                            delay: fadeOutStart,
                            onComplete: onFinished,
                            ease: 'power1.out'
                        });
                    }
                });
            } else {
                setTimeout(onFinished, deathDuration * 1000); // Convert to milliseconds
            }
        } else {
            // If no dying animation, fade out immediately
            if (this.model) {
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.material.transparent = true; // Enable opacity fading

                        // Use GSAP to fade out opacity
                        gsap.to(child.material, {
                            opacity: 0,
                            duration: 1,
                            onComplete: () => {
                                if (this.scene && this.model) {
                                    this.scene.remove(this.model);
                                    this.model = null;
                                }
                                if (this.world && this.body) {
                                    this.world.removeBody(this.body);
                                    this.body = null;
                                }
                            },
                            ease: 'power1.out'
                        });
                    }
                });
            } else {
                // Remove body immediately if no model exists
                if (this.world && this.body) {
                    this.world.removeBody(this.body);
                    this.body = null;
                }
            }
        }
    }

    // Check collision with other zombies and avoid them
    avoidCollisionWithOtherZombies() {
        this.zombies.forEach(zombie => {
            if (zombie.model && zombie !== this && !zombie.isDead) {
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
        // Only update animations if we have a mixer and the zombie isn't dead
        if (this.mixer && (!this.isDead || (this.isDead && this.currentDyingAnimation?.isRunning()))) {
            this.mixer.update(delta);
        }

        // Stop further updates for dead zombies
        if (this.model == null || this.isDead) {
            return;
        }

        // Sync physics body with Three.js mesh
        this.body.position.copy(this.model.position);
        this.body.quaternion.copy(this.model.quaternion);
        // Check if zombies stay within world bounds
        this.checkBounds();
        this.updateLifeBar();

        // Get camera/player position
        const cameraPosition = new THREE.Vector3(controls.object.position.x, 0, controls.object.position.z);
        const zombiePosition = this.model.position;
        const direction = new THREE.Vector3().subVectors(cameraPosition, zombiePosition).normalize();
        const distanceToCamera = zombiePosition.distanceTo(cameraPosition);

        // Adjust zombie rotation to face the player
        this.model.lookAt(cameraPosition);

        // Avoid collision with other zombies
        this.avoidCollisionWithOtherZombies();

        // Play sound only when within a certain proximity to the player
        const soundProximity = 50; // Adjust this value as needed
        if (distanceToCamera <= soundProximity) {
            if (this.sound.paused) {
                this.sound.play();
            }
        } else {
            if (!this.sound.paused) {
                this.sound.pause();
            }
        }

        if (this.isAlerted) {
            if (distanceToCamera > this.attackDistance) {
                this.isAttacking = false;
                this.playAnimation(this.currentChaseAnimation);
                direction.normalize();
                this.model.position.add(direction.multiplyScalar(this.speed));
                this.model.lookAt(cameraPosition);
            } else if (distanceToCamera <= this.attackDistance) {
                this.isAttacking = true;
                this.playAnimation(this.currentAttackAnimation);
            }
        } else {
            if (distanceToCamera > this.idleDistance) {
                this.isAttacking = false;
                this.playIdleAnimation(1);
            } else if (distanceToCamera <= this.idleDistance && distanceToCamera > this.attackDistance) {
                this.isAttacking = false;
                this.playAnimation(this.currentChaseAnimation);
                direction.normalize();
                this.model.position.add(direction.multiplyScalar(this.speed));
                this.model.lookAt(cameraPosition);
            } else if (distanceToCamera <= this.attackDistance) {
                this.isAttacking = true;
                this.playAnimation(this.currentAttackAnimation);
            }
        }
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

    playIdleAnimation(delta) {
        if (!this.inIdleAnimation) {
            this.inIdleAnimation = true;
            this.idleTimer = this.idleDuration; // Reset the idle timer
            this.playAnimation(this.currentIdleAnimation);
        } else {
            // Reduce the timer by the delta time (time passed)
            this.idleTimer -= delta;
            if (this.idleTimer <= 0) {
                this.inIdleAnimation = false; // Exit idle state after duration
            }
        }
    }

    triggerAlert() {
        console.log("sound heard")
        this.isAlerted = true;

        setTimeout(() => {
            this.isAlerted = false;
        }, 30000);
    }
}

export default Zombie;