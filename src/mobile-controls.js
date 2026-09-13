const JOYSTICK_DEAD_ZONE = 0.2;
const JOYSTICK_MAX_DISTANCE = 42;
const CAMERA_ROTATION_SENSITIVITY = 0.006;

function distanceBetween(first, second) {
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

export function createMobileControls({ input, camera }) {
  const root = document.querySelector('#mobile-controls');
  const joystick = document.querySelector('#mobile-joystick');
  const joystickThumb = document.querySelector('#mobile-joystick-thumb');
  const cameraPad = document.querySelector('#mobile-camera-pad');
  if (!root || !joystick || !joystickThumb || !cameraPad) return;

  const joystickPointers = new Map();
  const cameraPointers = new Map();
  let lastCameraPoint = null;
  let pinchDistance = null;

  function updateJoystick(pointer) {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = pointer.clientX - centerX;
    const deltaY = pointer.clientY - centerY;
    const distance = Math.min(JOYSTICK_MAX_DISTANCE, Math.hypot(deltaX, deltaY));
    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    joystickThumb.style.transform = `translate(${x}px, ${y}px)`;

    const normalizedX = x / JOYSTICK_MAX_DISTANCE;
    const normalizedY = y / JOYSTICK_MAX_DISTANCE;
    const keys = [];
    if (normalizedY < -JOYSTICK_DEAD_ZONE) keys.push('w');
    if (normalizedY > JOYSTICK_DEAD_ZONE) keys.push('s');
    if (normalizedX < -JOYSTICK_DEAD_ZONE) keys.push('a');
    if (normalizedX > JOYSTICK_DEAD_ZONE) keys.push('d');
    input.setVirtualKeys(keys);
  }

  function resetJoystick() {
    joystickPointers.clear();
    joystickThumb.style.transform = 'translate(0, 0)';
    input.setVirtualKeys([]);
  }

  joystick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    joystick.setPointerCapture?.(event.pointerId);
    joystickPointers.set(event.pointerId, event);
    updateJoystick(event);
  });
  joystick.addEventListener('pointermove', (event) => {
    if (!joystickPointers.has(event.pointerId)) return;
    event.preventDefault();
    joystickPointers.set(event.pointerId, event);
    updateJoystick(event);
  });
  joystick.addEventListener('pointerup', (event) => {
    if (joystickPointers.has(event.pointerId)) resetJoystick();
  });
  joystick.addEventListener('pointercancel', resetJoystick);

  function updateCamera(pointer) {
    if (cameraPointers.size > 1) return;
    if (!lastCameraPoint) {
      lastCameraPoint = pointer;
      return;
    }
    camera.rotateOrbit(
      (pointer.clientX - lastCameraPoint.clientX) * CAMERA_ROTATION_SENSITIVITY,
      (pointer.clientY - lastCameraPoint.clientY) * CAMERA_ROTATION_SENSITIVITY,
    );
    lastCameraPoint = pointer;
  }

  cameraPad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    cameraPad.setPointerCapture?.(event.pointerId);
    cameraPointers.set(event.pointerId, event);
    if (cameraPointers.size === 2) {
      const points = [...cameraPointers.values()];
      pinchDistance = distanceBetween(points[0], points[1]);
      lastCameraPoint = null;
    } else {
      lastCameraPoint = event;
    }
  });
  cameraPad.addEventListener('pointermove', (event) => {
    if (!cameraPointers.has(event.pointerId)) return;
    event.preventDefault();
    cameraPointers.set(event.pointerId, event);
    if (cameraPointers.size > 1) {
      const points = [...cameraPointers.values()];
      const nextDistance = distanceBetween(points[0], points[1]);
      if (pinchDistance !== null) camera.zoom((pinchDistance - nextDistance) * 0.025);
      pinchDistance = nextDistance;
      return;
    }
    updateCamera(event);
  });
  const releaseCameraPointer = (event) => {
    cameraPointers.delete(event.pointerId);
    if (cameraPointers.size < 2) pinchDistance = null;
    lastCameraPoint = cameraPointers.size === 1 ? [...cameraPointers.values()][0] : null;
  };
  cameraPad.addEventListener('pointerup', releaseCameraPointer);
  cameraPad.addEventListener('pointercancel', releaseCameraPointer);

  root.querySelectorAll('[data-camera-zoom]').forEach((button) => {
    button.addEventListener('click', () => camera.zoom(Number(button.dataset.cameraZoom)));
  });
}