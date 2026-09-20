import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createEditorScene({
  canvas,
  lighting,
  skyColor,
  fog,
  onRender,
}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const editorGl = renderer.getContext();
  editorGl.enable(editorGl.CULL_FACE);
  editorGl.cullFace(editorGl.BACK);
  editorGl.frontFace(editorGl.CCW);
  renderer.setClearColor(new THREE.Color(...skyColor));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(...fog.color), fog.near, fog.far);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1600);
  camera.position.set(42, 64, 58);

  const orbit = new OrbitControls(camera, canvas);
  orbit.target.set(0, 0, 0);
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI / 2.05;
  orbit.minDistance = 4;
  orbit.maxDistance = 900;

  const ambientLight = new THREE.AmbientLight(0xffffff, lighting.ambientIntensity);
  const directionalLight = new THREE.DirectionalLight(0xffffff, lighting.directional.intensity);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.left = -80;
  directionalLight.shadow.camera.right = 80;
  directionalLight.shadow.camera.top = 80;
  directionalLight.shadow.camera.bottom = -80;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 180;
  directionalLight.shadow.bias = -0.0005;
  directionalLight.shadow.normalBias = 0.02;
  scene.add(ambientLight, directionalLight, directionalLight.target);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const gridHelper = new THREE.GridHelper(1024, 64, 0x53605a, 0x29312d);
  gridHelper.position.set(-0.5, -0.14, -0.5);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.3;
  worldGroup.add(gridHelper);

  const enemyAreaVisuals = new THREE.Group();
  worldGroup.add(enemyAreaVisuals);

  const entityGroup = new THREE.Group();
  worldGroup.add(entityGroup);

  const collisionGroup = new THREE.Group();
  worldGroup.add(collisionGroup);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hover = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.035, 1),
    new THREE.MeshBasicMaterial({ color: 0xb9ec69, wireframe: true }),
  );
  hover.visible = false;
  scene.add(hover);

  const resize = (canvasElement = canvas) => {
    const width = canvasElement.clientWidth;
    const height = canvasElement.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const updateSceneAtmosphere = (nextSkyColor = skyColor, nextFog = fog) => {
    renderer.setClearColor(new THREE.Color(...nextSkyColor));
    if (!scene.fog) scene.fog = new THREE.Fog(new THREE.Color(...nextFog.color), nextFog.near, nextFog.far);
    scene.fog.color.setRGB(...nextFog.color);
    scene.fog.near = nextFog.near;
    scene.fog.far = nextFog.far;
  };

  const updateSceneAmbientLight = (nextLighting = lighting) => {
    ambientLight.color.setRGB(...nextLighting.ambientColor);
    ambientLight.intensity = nextLighting.ambientIntensity;
    const direction = new THREE.Vector3(...nextLighting.directional.direction);
    if (direction.lengthSq() === 0) direction.set(-0.45, 0.85, 0.35);
    direction.normalize();
    directionalLight.position.copy(direction).multiplyScalar(-45);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.target.updateMatrixWorld();
    directionalLight.color.setRGB(...nextLighting.directional.color);
    directionalLight.intensity = nextLighting.directional.enabled === false ? 0 : nextLighting.directional.intensity;
    directionalLight.visible = nextLighting.directional.enabled !== false;
    directionalLight.castShadow = nextLighting.directional.castShadow !== false && nextLighting.directional.enabled !== false;
    directionalLight.shadow.needsUpdate = directionalLight.castShadow;
  };

  return {
    renderer,
    scene,
    camera,
    orbit,
    ambientLight,
    directionalLight,
    worldGroup,
    gridHelper,
    enemyAreaVisuals,
    entityGroup,
    collisionGroup,
    raycaster,
    pointer,
    hover,
    resize,
    updateSceneAtmosphere,
    updateSceneAmbientLight,
    disposeObject: (object) => {
      object.traverse((child) => {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
        else child.material?.dispose();
      });
    },
    renderFrame: (delta) => {
      if (typeof onRender === 'function') onRender(delta);
      orbit.update();
      renderer.render(scene, camera);
    },
  };
}
