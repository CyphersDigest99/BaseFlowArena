// js/threeBackground.js
// Handles the THREE.js background animation.

import * as THREE from 'three';

let scene, camera, renderer, roadLines = [], roadPlane;
const lineCount = 50;
const lineLength = 5;
const lineSpacing = 10;
const roadSpeed = 0.25;
let isThreeJsInitialized = false;
let animationFrameId = null; // To stop the animation loop if needed

export function initBackground(canvas) {
    if (!canvas || isThreeJsInitialized) return;
    console.log('Initializing Three.js background...');
    try {
        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 4, 10);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        scene.add(new THREE.AmbientLight(0x404060, 1));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        const roadGeometry = new THREE.PlaneGeometry(50, lineCount * lineSpacing * 1.5);
        const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9, metalness: 0.1 });
        roadPlane = new THREE.Mesh(roadGeometry, roadMaterial);
        roadPlane.rotation.x = -Math.PI / 2;
        roadPlane.position.y = -0.1;
        scene.add(roadPlane);

        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lineGeometry = new THREE.PlaneGeometry(0.2, lineLength);

        roadLines = []; // Clear previous lines if re-initializing
        for (let i = 0; i < lineCount; i++) {
            const line = new THREE.Mesh(lineGeometry, lineMaterial.clone()); // Use clone for materials if needed
            line.rotation.x = -Math.PI / 2;
            line.position.z = (i * -lineSpacing);
            line.position.y = 0;
            roadLines.push(line);
            scene.add(line);
        }

        window.addEventListener('resize', onWindowResize, false);
        animate(); // Start the animation loop
        isThreeJsInitialized = true;
        console.log('Three.js background initialized.');

    } catch (error) {
        console.error("Error initializing Three.js:", error);
        if(canvas) canvas.style.display = 'none';
        isThreeJsInitialized = false;
    }
}

function animate() {
    if (!isThreeJsInitialized) return; // Stop if not initialized

    animationFrameId = requestAnimationFrame(animate); // Store the frame ID

    roadLines.forEach(line => {
        line.position.z += roadSpeed;
        if (line.position.z - (lineLength / 2) > camera.position.z) {
            line.position.z -= lineCount * lineSpacing;
        }
    });

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    if (!isThreeJsInitialized || !camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // console.log('Three.js background resized.'); // Less noise
}

// Optional: Function to stop the animation and clean up resources
export function stopBackground() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    window.removeEventListener('resize', onWindowResize);
    // Dispose of THREE.js objects if needed (geometry, materials, renderer)
    // renderer?.dispose(); // etc.
    isThreeJsInitialized = false;
    console.log("Three.js background stopped and cleaned up.");
}