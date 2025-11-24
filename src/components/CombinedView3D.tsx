import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { TrinityValue } from "../types";

interface Props {
    points: Array<{ hour: number; values: TrinityValue; count: number }>;
    height?: number;
}

// 3D 散点 + 柱状 + 点击提示：X=小时，Y=生理，Z=认知，颜色=冲动（红高蓝低）
export const CombinedView3D: React.FC<Props> = ({ points, height = 320 }) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        const width = mountRef.current.clientWidth;
        const h = Math.max(height, Math.floor(width * 0.7));

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#0a0a0a"); // Brighter background
        // Add subtle fog for depth
        scene.fog = new THREE.FogExp2(0x0a0a0a, 0.015);

        const camera = new THREE.PerspectiveCamera(45, width / h, 0.1, 1000);
        camera.position.set(24, 20, 36);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, h);
        renderer.setPixelRatio(window.devicePixelRatio);
        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 10;
        controls.maxDistance = 80;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;

        // Axes + grid
        // scene.add(new THREE.AxesHelper(20)); // Hide default axes, use custom labels
        const gridHelper = new THREE.GridHelper(60, 24, "#333", "#111");
        gridHelper.position.y = -2;
        scene.add(gridHelper);

        // Lights - Enhanced for better visibility
        const light = new THREE.DirectionalLight("#ffffff", 4.5); // Increased intensity
        light.position.set(10, 20, 10);
        scene.add(light);
        const light2 = new THREE.DirectionalLight("#4444ff", 2.0); // Brighter rim light
        light2.position.set(-10, 10, -10);
        scene.add(light2);
        scene.add(new THREE.AmbientLight("#505050", 3.5)); // Brighter ambient

        // Add a warm point light for highlights
        const pointLight = new THREE.PointLight("#ffaa00", 3, 100);
        pointLight.position.set(5, 10, 5);
        scene.add(pointLight);

        // Helper to create text sprites
        const createTextSprite = (text: string, color: string = "#ffffff", size: number = 1) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            const fontSize = 64;
            ctx.font = `bold ${fontSize}px Arial`;
            const textWidth = ctx.measureText(text).width;
            canvas.width = textWidth + 20;
            canvas.height = fontSize + 20;

            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);

            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(canvas.width / fontSize * size, canvas.height / fontSize * size, 1);
            return sprite;
        };

        // Add Axis Labels
        const xLabel = createTextSprite("Time (0-23h)", "#888", 1.5);
        if (xLabel) { xLabel.position.set(16, -2, 0); scene.add(xLabel); }

        const yLabel = createTextSprite("Physiological (Height)", "#4ade80", 1.5); // Green
        if (yLabel) { yLabel.position.set(0, 10, 0); scene.add(yLabel); }

        const zLabel = createTextSprite("Cognitive (Depth)", "#60a5fa", 1.5); // Blue
        if (zLabel) { zLabel.position.set(0, -2, 16); scene.add(zLabel); }

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const pointMeshes: THREE.Object3D[] = [];
        const barGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
        const sphere = new THREE.SphereGeometry(0.3, 16, 16);

        // Add points/bars
        points.forEach(pt => {
            const color = new THREE.Color();
            // Color based on Impulse (S): Blue (Low) -> Red (High)
            // S: 0 -> Blue, 5 -> Purple, 10 -> Red
            const hue = 0.66 - (pt.values.s / 10) * 0.66; // 0.66 (Blue) -> 0 (Red)
            color.setHSL(hue, 0.8, 0.5);

            const material = new THREE.MeshStandardMaterial({
                color,
                roughness: 0.15, // Smoother for more reflection
                metalness: 0.4,
                emissive: color,
                emissiveIntensity: 0.8 // Much brighter glow
            });

            const x = (pt.hour - 12) * 1.5; // Spread out time
            const y = (pt.values.p - 5); // Height = P
            const z = (pt.values.c - 5) * 1.5; // Depth = C

            // Bar (Stem)
            const barHeight = Math.abs(y + 2); // Connect to ground (-2)
            const bar = new THREE.Mesh(barGeo, material.clone());
            // Make bar slightly transparent
            (bar.material as THREE.MeshStandardMaterial).transparent = true;
            (bar.material as THREE.MeshStandardMaterial).opacity = 0.3;

            bar.scale.set(0.2, barHeight, 0.2);
            bar.position.set(x, -2 + barHeight / 2, z);
            scene.add(bar);

            // Sphere (Data Point)
            const mesh = new THREE.Mesh(sphere, material);
            mesh.position.set(x, y, z);
            mesh.userData = {
                label: `${pt.hour}:00\nP: ${pt.values.p.toFixed(1)} (高)\nC: ${pt.values.c.toFixed(1)} (深)\nS: ${pt.values.s.toFixed(1)} (色)`
            };
            scene.add(mesh);
            pointMeshes.push(mesh);
        });

        let crossLines: THREE.Line[] = [];
        const clearCross = () => {
            crossLines.forEach(l => scene.remove(l));
            crossLines = [];
        };
        const addCross = (pos: THREE.Vector3) => {
            clearCross();
            const material = new THREE.LineBasicMaterial({ color: "#ffffff", opacity: 0.5, transparent: true });
            const targets = [
                new THREE.Vector3(pos.x, -2, pos.z), // Down to floor
                new THREE.Vector3(0, pos.y, pos.z),  // To Y axis
                new THREE.Vector3(pos.x, pos.y, 0),  // To Z axis
            ];
            targets.forEach(t => {
                const geo = new THREE.BufferGeometry().setFromPoints([pos, t]);
                const line = new THREE.Line(geo, material);
                crossLines.push(line);
                scene.add(line);
            });
        };

        const handleClick = (event: MouseEvent) => {
            if (!mountRef.current) return;
            // Stop auto rotation on interaction
            controls.autoRotate = false;

            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(pointMeshes, false);
            if (intersects.length > 0) {
                const obj = intersects[0].object;
                const label = obj.userData.label as string;
                addCross(obj.position.clone());
                setTooltip({ text: label, x: event.clientX, y: event.clientY });
            } else {
                clearCross();
                setTooltip(null);
                controls.autoRotate = true; // Resume rotation
            }
        };

        const animate = () => {
            controls.update();
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        };
        animate();

        const handleResize = () => {
            if (!mountRef.current) return;
            const w = mountRef.current.clientWidth;
            const h2 = Math.max(height, Math.floor(w * 0.7));
            renderer.setSize(w, h2);
            camera.aspect = w / h2;
            camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", handleResize);
        renderer.domElement.addEventListener("click", handleClick);

        return () => {
            window.removeEventListener("resize", handleResize);
            renderer.domElement.removeEventListener("click", handleClick);
            clearCross();
            controls.dispose();
            renderer.dispose();
        };
    }, [points, height]);

    return (
        <div className="relative w-full rounded-xl border border-white/10 overflow-hidden bg-gradient-to-b from-black to-gray-900">
            <div ref={mountRef} className="w-full" />
            {tooltip && (
                <div
                    className="pointer-events-none absolute bg-black/90 text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-white/20 whitespace-pre-line z-10"
                    style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
                >
                    {tooltip.text}
                </div>
            )}
            <div className="absolute bottom-2 right-2 text-[10px] text-gray-500 pointer-events-none">
                拖拽旋转 · 滚轮缩放 · 点击查看
            </div>
        </div>
    );
};
